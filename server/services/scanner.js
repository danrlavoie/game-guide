var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { getDb } = require('../db');
var config = require('../config');
var { execAsync } = require('../utils/exec');
var thumbnail = require('./thumbnail');

var SUPPORTED_EXTENSIONS = ['.pdf', '.cbz'];

function scan() {
  return new Promise(function(resolve, reject) {
    try {
      var db = getDb();
      var documentsPath = config.documentsPath;

      if (!fs.existsSync(documentsPath)) {
        return reject(new Error('Documents path does not exist: ' + documentsPath));
      }

      // Walk directory and collect files
      console.log('Scanning documents directory...');
      var files = walkDirectory(documentsPath, documentsPath);
      console.log('Found ' + files.length + ' documents');

      // Get existing documents from DB
      var existing = {};
      db.prepare('SELECT id, file_path, file_hash FROM documents').all()
        .forEach(function(row) {
          existing[row.file_path] = row;
        });

      var added = 0;
      var updated = 0;
      var removed = 0;
      var newDocIds = [];

      // Process found files
      var seenPaths = {};
      var insertStmt = db.prepare('\
        INSERT INTO documents (file_path, file_name, file_type, file_size, page_count, parent_folder, file_hash) \
        VALUES (?, ?, ?, ?, ?, ?, ?)\
      ');
      var updateStmt = db.prepare('\
        UPDATE documents SET file_size = ?, page_count = ?, file_hash = ?, \
        thumbnail_generated = 0, updated_at = datetime(\'now\') WHERE id = ?\
      ');

      var transaction = db.transaction(function() {
        files.forEach(function(file) {
          seenPaths[file.relativePath] = true;
          var hash = computePartialHash(file.fullPath);
          var ext = path.extname(file.relativePath).toLowerCase();
          var fileType = ext === '.pdf' ? 'pdf' : 'cbz';
          var stat = fs.statSync(file.fullPath);
          var parentFolder = path.dirname(file.relativePath);
          if (parentFolder === '.') parentFolder = '';

          var existingDoc = existing[file.relativePath];

          if (!existingDoc) {
            // New file
            var info = insertStmt.run(
              file.relativePath,
              path.basename(file.relativePath),
              fileType,
              stat.size,
              0, // page_count filled async
              parentFolder,
              hash
            );
            newDocIds.push({ id: info.lastInsertRowid, fullPath: file.fullPath, type: fileType });
            added++;
          } else if (existingDoc.file_hash !== hash) {
            // Changed file
            updateStmt.run(stat.size, 0, hash, existingDoc.id);
            newDocIds.push({ id: existingDoc.id, fullPath: file.fullPath, type: fileType });
            // Invalidate cached pages
            invalidateCache(existingDoc.id);
            updated++;
          }
        });

        // Remove documents that no longer exist on disk
        Object.keys(existing).forEach(function(filePath) {
          if (!seenPaths[filePath]) {
            db.prepare('DELETE FROM documents WHERE id = ?').run(existing[filePath].id);
            invalidateCache(existing[filePath].id);
            removed++;
          }
        });
      });

      transaction();

      console.log('Cataloged: ' + added + ' new, ' + updated + ' changed, ' + removed + ' removed');

      if (newDocIds.length === 0) {
        return resolve({ added: added, updated: updated, removed: removed, total: files.length });
      }

      // Update page counts
      console.log('Extracting page counts for ' + newDocIds.length + ' documents...');
      updatePageCounts(newDocIds).then(function() {
        console.log('Page counts complete. Generating thumbnails...');
        return thumbnail.generateBatch(newDocIds);
      }).then(function() {
        console.log('Thumbnails complete.');
        resolve({ added: added, updated: updated, removed: removed, total: files.length });
      }).catch(function(err) {
        console.error('Post-scan processing error:', err);
        resolve({ added: added, updated: updated, removed: removed, total: files.length });
      });

    } catch (err) {
      reject(err);
    }
  });
}

function walkDirectory(dir, rootDir) {
  var results = [];
  var entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error('Cannot read directory:', dir, err.message);
    return results;
  }

  entries.forEach(function(entry) {
    var fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results = results.concat(walkDirectory(fullPath, rootDir));
    } else if (entry.isFile()) {
      var ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.indexOf(ext) !== -1) {
        var relativePath = path.relative(rootDir, fullPath);
        results.push({ fullPath: fullPath, relativePath: relativePath });
      }
    }
  });

  return results;
}

function computePartialHash(filePath) {
  try {
    var fd = fs.openSync(filePath, 'r');
    var buffer = Buffer.alloc(65536); // 64KB
    var bytesRead = fs.readSync(fd, buffer, 0, 65536, 0);
    fs.closeSync(fd);
    return crypto.createHash('sha256').update(buffer.slice(0, bytesRead)).digest('hex');
  } catch (err) {
    console.error('Hash error for', filePath, err.message);
    return null;
  }
}

function updatePageCounts(docs) {
  var db = getDb();
  var updateStmt = db.prepare('UPDATE documents SET page_count = ? WHERE id = ?');
  var done = 0;
  var total = docs.length;

  // Process in batches of 10 to avoid overwhelming the system
  var chain = Promise.resolve();
  var batchSize = 10;

  for (var i = 0; i < docs.length; i += batchSize) {
    (function(batch) {
      chain = chain.then(function() {
        return Promise.all(batch.map(function(doc) {
          return getPageCount(doc.fullPath, doc.type)
            .then(function(count) {
              updateStmt.run(count, doc.id);
              done++;
              if (done % 25 === 0 || done === total) {
                process.stdout.write('\r  Page counts: ' + done + ' / ' + total);
              }
            })
            .catch(function(err) {
              done++;
              console.error('\nPage count error for', doc.fullPath, err.message);
            });
        }));
      });
    })(docs.slice(i, i + batchSize));
  }

  return chain.then(function() {
    if (total > 0) process.stdout.write('\n');
  });
}

function getPageCount(filePath, fileType) {
  if (fileType === 'pdf') {
    return execAsync('pdfinfo "' + filePath.replace(/"/g, '\\"') + '"')
      .then(function(stdout) {
        var match = stdout.match(/Pages:\s+(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
  } else {
    // CBZ: count image files in ZIP
    return execAsync('unzip -l "' + filePath.replace(/"/g, '\\"') + '"')
      .then(function(stdout) {
        var lines = stdout.split('\n');
        var count = 0;
        lines.forEach(function(line) {
          if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(line)) {
            count++;
          }
        });
        return count;
      });
  }
}

function invalidateCache(docId) {
  var pageCacheDir = path.join(config.pagesPath, String(docId));
  var thumbPath = path.join(config.thumbnailsPath, docId + '.jpg');

  try {
    if (fs.existsSync(pageCacheDir)) {
      fs.rmSync(pageCacheDir, { recursive: true });
    }
  } catch (err) {
    console.error('Cache invalidation error:', err.message);
  }

  try {
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
  } catch (err) {
    // Ignore
  }
}

module.exports = { scan };
