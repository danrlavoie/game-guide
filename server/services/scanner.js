var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { getDb } = require('../db');
var config = require('../config');
var { execAsync, shellEscape } = require('../utils/exec');
var { isZipFile, isRarFile } = require('../utils/archive');
var thumbnail = require('./thumbnail');
var log = require('../logger').child({ component: 'scanner' });

var SUPPORTED_EXTENSIONS = ['.pdf', '.cbz', '.cbr', '.txt'];

function scan() {
  try {
    var db = getDb();
    var documentsPath = config.documentsPath;

    if (!fs.existsSync(documentsPath)) {
      return Promise.reject(new Error('Documents path does not exist: ' + documentsPath));
    }

    // Walk directory and collect files with stat info
    log.info('Scanning documents directory');
    var files = walkDirectory(documentsPath, documentsPath);
    log.info({ count: files.length }, 'Found documents');

    // Get existing documents from DB (include size + mtime for fast comparison)
    var existing = {};
    db.prepare('SELECT id, file_path, file_hash, file_size, file_mtime FROM documents').all()
      .forEach(function(row) {
        existing[row.file_path] = row;
      });

    var added = 0;
    var updated = 0;
    var removed = 0;
    var unchanged = 0;
    var newDocIds = [];

    // Process found files
    var seenPaths = {};
    var insertStmt = db.prepare('\
      INSERT INTO documents (file_path, file_name, file_type, file_size, page_count, parent_folder, file_hash, file_mtime) \
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)\
    ');
    var updateStmt = db.prepare('\
      UPDATE documents SET file_size = ?, page_count = ?, file_hash = ?, file_mtime = ?, \
      thumbnail_generated = 0, updated_at = datetime(\'now\') WHERE id = ?\
    ');

    var processed = 0;
    var fileTotal = files.length;

    var transaction = db.transaction(function() {
      files.forEach(function(file) {
        seenPaths[file.relativePath] = true;
        var ext = path.extname(file.relativePath).toLowerCase();
        var fileType = ext === '.pdf' ? 'pdf' : (ext === '.txt' ? 'txt' : (ext === '.cbr' ? 'cbr' : 'cbz'));
        var parentFolder = path.dirname(file.relativePath);
        if (parentFolder === '.') parentFolder = '';

        var existingDoc = existing[file.relativePath];

        if (!existingDoc) {
          // New file — insert without hashing (nothing to compare against)
          var info = insertStmt.run(
            file.relativePath,
            path.basename(file.relativePath),
            fileType,
            file.size,
            0, // page_count filled async
            parentFolder,
            null, // hash computed lazily if needed later
            file.mtime
          );
          newDocIds.push({ id: info.lastInsertRowid, fullPath: file.fullPath, type: fileType });
          added++;
        } else if (existingDoc.file_size === file.size && existingDoc.file_mtime === file.mtime) {
          // Size and mtime match — skip entirely (no hash needed)
          unchanged++;
        } else {
          // Size or mtime changed — compute hash and compare
          var hash = computePartialHash(file.fullPath);
          if (existingDoc.file_hash && existingDoc.file_hash === hash) {
            // Hash matches despite mtime change (e.g. file touched but not modified)
            // Update mtime so we skip next time
            db.prepare('UPDATE documents SET file_mtime = ? WHERE id = ?').run(file.mtime, existingDoc.id);
            unchanged++;
          } else {
            // Actually changed
            updateStmt.run(file.size, 0, hash, file.mtime, existingDoc.id);
            newDocIds.push({ id: existingDoc.id, fullPath: file.fullPath, type: fileType });
            invalidateCache(existingDoc.id);
            updated++;
          }
        }

        processed++;
        if (processed % 100 === 0 || processed === fileTotal) {
          process.stdout.write('\r  Cataloging: ' + processed + ' / ' + fileTotal +
            ' (' + added + ' new, ' + updated + ' updated, ' + unchanged + ' unchanged)');
        }
      });

      if (fileTotal > 0) process.stdout.write('\n');

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

    log.info({ added: added, updated: updated, removed: removed, unchanged: unchanged }, 'Catalog complete');

    var result = { added: added, updated: updated, removed: removed, total: files.length };

    // Filter txt files from background work (no page counts or thumbnails)
    var mediaDocs = newDocIds.filter(function(d) { return d.type !== 'txt'; });

    if (mediaDocs.length === 0) {
      return Promise.resolve({ result: result, backgroundWork: Promise.resolve() });
    }

    // Defer page counts + thumbnails to background
    log.info({ count: mediaDocs.length }, 'Starting background processing');
    var backgroundWork = updatePageCounts(mediaDocs).then(function() {
      log.info('Page counts complete, generating thumbnails');
      return thumbnail.generateBatch(mediaDocs);
    }).then(function() {
      log.info('Background processing complete');
    }).catch(function(err) {
      log.error({ err: err }, 'Background processing error');
    });

    return Promise.resolve({ result: result, backgroundWork: backgroundWork });

  } catch (err) {
    return Promise.reject(err);
  }
}

function walkDirectory(dir, rootDir) {
  var results = [];
  var entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    log.error({ dir: dir, err: { message: err.message } }, 'Cannot read directory');
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
        try {
          var stat = fs.statSync(fullPath);
          results.push({
            fullPath: fullPath,
            relativePath: relativePath,
            size: stat.size,
            mtime: stat.mtimeMs
          });
        } catch (err) {
          log.error({ file: fullPath, err: { message: err.message } }, 'Cannot stat file');
        }
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
    log.error({ file: filePath, err: { message: err.message } }, 'Hash computation failed');
    return null;
  }
}

function updatePageCounts(docs) {
  var db = getDb();
  var updateStmt = db.prepare('UPDATE documents SET page_count = ? WHERE id = ?');
  var done = 0;
  var total = docs.length;

  var chain = Promise.resolve();
  var batchSize = 50;

  for (var i = 0; i < docs.length; i += batchSize) {
    (function(batch) {
      chain = chain.then(function() {
        return Promise.all(batch.map(function(doc) {
          return getPageCount(doc.fullPath, doc.type)
            .then(function(count) {
              updateStmt.run(count, doc.id);
              done++;
              if (done % 50 === 0 || done === total) {
                process.stdout.write('\r  Page counts: ' + done + ' / ' + total);
              }
            })
            .catch(function(err) {
              done++;
              log.error({ file: doc.fullPath, err: { message: err.message } }, 'Page count failed');
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
    return execAsync('pdfinfo "' + shellEscape(filePath) + '"')
      .then(function(stdout) {
        var match = stdout.match(/Pages:\s+(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
  } else if (fileType === 'cbr') {
    var escapedCbr = shellEscape(filePath);
    if (isZipFile(filePath)) {
      // Mislabeled ZIP with .cbr extension — use unzip
      return execAsync('unzip -l "' + escapedCbr + '"')
        .then(function(stdout) {
          return countImageLines(stdout);
        })
        .catch(function(err) {
          log.error({ file: filePath, fileType: 'cbr', format: 'zip', err: { message: err.message } }, 'Archive read error');
          return 0;
        });
    }
    // Real RAR archive
    return execAsync('unrar lb "' + escapedCbr + '"')
      .then(function(stdout) {
        return countImageLines(stdout);
      })
      .catch(function(err) {
        log.error({ file: filePath, fileType: 'cbr', err: { message: err.message } }, 'Archive read error');
        return 0;
      });
  } else {
    // CBZ: count image files in ZIP (or RAR if mislabeled)
    if (isRarFile(filePath)) {
      return execAsync('unrar lb "' + shellEscape(filePath) + '"')
        .then(function(stdout) {
          return countImageLines(stdout);
        })
        .catch(function(err) {
          log.error({ file: filePath, fileType: 'cbz', format: 'rar', err: { message: err.message } }, 'Archive read error');
          return 0;
        });
    }
    return execAsync('unzip -l "' + shellEscape(filePath) + '"')
      .then(function(stdout) {
        return countImageLines(stdout);
      })
      .catch(function(err) {
        var msg = err.message || '';
        if (msg.indexOf('End-of-central-directory') !== -1 || msg.indexOf('not a zipfile') !== -1) {
          log.warn({ file: filePath, fileType: 'cbz' }, 'Skipping invalid CBZ (not a valid ZIP)');
        } else {
          log.error({ file: filePath, fileType: 'cbz', err: { message: msg } }, 'Archive read error');
        }
        return 0;
      });
  }
}

function countImageLines(stdout) {
  var lines = stdout.split('\n');
  var count = 0;
  lines.forEach(function(line) {
    if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(line)) {
      count++;
    }
  });
  return count;
}

function invalidateCache(docId) {
  var pageCacheDir = path.join(config.pagesPath, String(docId));
  var thumbPath = path.join(config.thumbnailsPath, docId + '.jpg');

  try {
    if (fs.existsSync(pageCacheDir)) {
      fs.rmSync(pageCacheDir, { recursive: true });
    }
  } catch (err) {
    log.warn({ docId: docId, err: { message: err.message } }, 'Cache invalidation error');
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
