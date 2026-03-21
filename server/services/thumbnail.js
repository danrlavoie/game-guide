var fs = require('fs');
var path = require('path');
var sharp = require('sharp');
sharp.cache(false); // Prevent decoded image cache from accumulating over large batches
var config = require('../config');
var { getDb } = require('../db');
var { execAsync, shellEscape } = require('../utils/exec');
var { isZipFile, isRarFile } = require('../utils/archive');
var log = require('../logger').child({ component: 'thumbnail' });

function getThumbnail(doc, fullPath) {
  var thumbPath = path.join(config.thumbnailsPath, doc.id + '.jpg');

  if (fs.existsSync(thumbPath)) {
    return Promise.resolve(thumbPath);
  }

  // Ensure thumbnails directory
  fs.mkdirSync(config.thumbnailsPath, { recursive: true });

  return generateThumbnail(doc, fullPath, thumbPath);
}

function generateThumbnail(doc, fullPath, thumbPath) {
  if (doc.file_type === 'pdf') {
    return generatePdfThumbnail(fullPath, thumbPath);
  } else if (doc.file_type === 'cbr') {
    return generateCbrThumbnail(fullPath, thumbPath);
  } else if (doc.file_type === 'cbz') {
    return generateCbzThumbnail(fullPath, thumbPath);
  }
  return Promise.reject(new Error('Unsupported type'));
}

function generatePdfThumbnail(pdfPath, thumbPath) {
  var tempDir = path.dirname(thumbPath);
  var tempPrefix = path.join(tempDir, 'thumb_temp_' + Date.now());
  var escapedPath = shellEscape(pdfPath);

  // Render first page at low DPI for thumbnail
  var cmd =
    'pdftoppm -jpeg -jpegopt quality=80 -r 72 -f 1 -l 1 "' +
    escapedPath +
    '" "' +
    tempPrefix +
    '"';

  return execAsync(cmd).then(function () {
    // Find generated file
    var dir = path.dirname(tempPrefix);
    var prefix = path.basename(tempPrefix);
    var files = fs.readdirSync(dir).filter(function (f) {
      return f.startsWith(prefix) && f.endsWith('.jpg');
    });

    if (files.length === 0) {
      throw new Error('pdftoppm produced no thumbnail');
    }

    var generatedFile = path.join(dir, files[0]);

    // Resize to thumbnail width
    return sharp(generatedFile)
      .resize(config.thumbnailWidth)
      .jpeg({ quality: 80 })
      .toFile(thumbPath)
      .then(function () {
        fs.unlinkSync(generatedFile);
        return thumbPath;
      });
  });
}

function generateCbzThumbnail(cbzPath, thumbPath) {
  if (isRarFile(cbzPath)) {
    return generateCbrThumbnail(cbzPath, thumbPath);
  }

  var escapedPath = shellEscape(cbzPath);
  var tempDir = path.join(
    path.dirname(thumbPath),
    'tmp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
  );
  fs.mkdirSync(tempDir, { recursive: true });

  return execAsync('unzip -l "' + escapedPath + '"').then(function (stdout) {
    var lines = stdout.split('\n');
    var imageFiles = [];

    lines.forEach(function (line) {
      var match = line.match(
        /\d+\s+\d{2,4}-\d{2}-\d{2,4}\s+\d{2}:\d{2}\s+(.+)/
      );
      if (match) {
        var filename = match[1].trim();
        if (
          /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename) &&
          !filename.startsWith('__MACOSX')
        ) {
          imageFiles.push(filename);
        }
      }
    });

    imageFiles.sort();

    if (imageFiles.length === 0) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw new Error(
        'No images found in CBZ (parsed 0 image entries from ' +
          lines.length +
          ' listing lines)'
      );
    }

    var firstImage = imageFiles[0];
    var escapedTarget = shellEscape(firstImage);

    return execAsync(
      'unzip -o -j "' +
        escapedPath +
        '" "' +
        escapedTarget +
        '" -d "' +
        tempDir +
        '"'
    )
      .catch(function () {
        // Exit code 1 = warning (e.g. Unicode issues) but file may have extracted
        if (findFirstImageInDir(tempDir)) return;
        // Filename encoding mismatch — extract all files as fallback
        return execAsync(
          'unzip -o -j "' + escapedPath + '" -d "' + tempDir + '"'
        );
      })
      .then(function () {
        var extractedFile = findFirstImageInDir(tempDir);
        if (!extractedFile) {
          throw new Error('No images extracted from CBZ');
        }

        return sharp(path.join(tempDir, extractedFile))
          .resize(config.thumbnailWidth)
          .jpeg({ quality: 80 })
          .toFile(thumbPath)
          .then(function () {
            fs.rmSync(tempDir, { recursive: true, force: true });
            return thumbPath;
          });
      });
  });
}

function generateCbrThumbnail(cbrPath, thumbPath) {
  if (isZipFile(cbrPath)) {
    return generateCbzThumbnail(cbrPath, thumbPath);
  }

  var escapedPath = shellEscape(cbrPath);
  var tempDir = path.join(
    path.dirname(thumbPath),
    'tmp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
  );
  fs.mkdirSync(tempDir, { recursive: true });

  return execAsync('unrar lb "' + escapedPath + '"').then(function (stdout) {
    var lines = stdout.split('\n');
    var imageFiles = [];

    lines.forEach(function (line) {
      var filename = line.trim();
      if (
        filename &&
        /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename) &&
        filename.indexOf('__MACOSX') === -1
      ) {
        imageFiles.push(filename);
      }
    });

    imageFiles.sort();

    if (imageFiles.length === 0) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      throw new Error(
        'No images found in CBR (parsed 0 image entries from ' +
          lines.length +
          ' listing lines)'
      );
    }

    var firstImage = imageFiles[0];
    var escapedTarget = shellEscape(firstImage);

    return execAsync(
      'unrar e -o+ "' +
        escapedPath +
        '" "' +
        escapedTarget +
        '" "' +
        tempDir +
        '/"'
    ).then(function () {
      var extractedPath = path.join(tempDir, path.basename(firstImage));

      return sharp(extractedPath)
        .resize(config.thumbnailWidth)
        .jpeg({ quality: 80 })
        .toFile(thumbPath)
        .then(function () {
          fs.rmSync(tempDir, { recursive: true, force: true });
          return thumbPath;
        });
    });
  });
}

function findFirstImageInDir(dir) {
  var files = fs
    .readdirSync(dir)
    .filter(function (f) {
      return (
        /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f) && !f.startsWith('__MACOSX')
      );
    })
    .sort();
  return files.length > 0 ? files[0] : null;
}

function generateBatch(docs) {
  var db = getDb();
  var updateStmt = db.prepare(
    'UPDATE documents SET thumbnail_generated = 1 WHERE id = ?'
  );
  var done = 0;
  var total = docs.length;

  // Ensure thumbnails directory exists once
  fs.mkdirSync(config.thumbnailsPath, { recursive: true });

  // Process thumbnails in parallel batches of 5
  var chain = Promise.resolve();
  var batchSize = 5;

  for (var i = 0; i < docs.length; i += batchSize) {
    (function (batch) {
      chain = chain.then(function () {
        return Promise.all(
          batch.map(function (doc) {
            var thumbPath = path.join(config.thumbnailsPath, doc.id + '.jpg');

            return generateThumbnail(
              { file_type: doc.type, id: doc.id },
              doc.fullPath,
              thumbPath
            )
              .then(function () {
                updateStmt.run(doc.id);
                done++;
                if (done % 10 === 0 || done === total) {
                  log.info(
                    { done: done, total: total },
                    'Thumbnail generation progress'
                  );
                }
              })
              .catch(function (err) {
                done++;
                log.error(
                  { file: doc.fullPath, err: { message: err.message } },
                  'Thumbnail generation failed'
                );
              });
          })
        );
      });
    })(docs.slice(i, i + batchSize));
  }

  return chain;
}

function cleanupTempDirs() {
  if (!fs.existsSync(config.thumbnailsPath)) return;
  var entries = fs.readdirSync(config.thumbnailsPath);
  entries.forEach(function (entry) {
    if (entry.startsWith('tmp_')) {
      fs.rmSync(path.join(config.thumbnailsPath, entry), {
        recursive: true,
        force: true,
      });
      log.info({ dir: entry }, 'Cleaned up orphaned temp directory');
    }
  });
}

module.exports = { getThumbnail, generateBatch, cleanupTempDirs };
