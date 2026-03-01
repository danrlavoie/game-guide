var fs = require('fs');
var path = require('path');
var config = require('../config');
var { execAsync, shellEscape } = require('../utils/exec');
var { isZipFile } = require('../utils/archive');

function getPage(doc, fullPath, pageNum) {
  var cacheDir = path.join(config.pagesPath, String(doc.id));
  var cachedPath = path.join(cacheDir, pageNum + '.jpg');

  // Check cache
  if (fs.existsSync(cachedPath)) {
    return Promise.resolve(cachedPath);
  }

  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  if (doc.file_type === 'pdf') {
    return renderPdfPage(fullPath, cacheDir, pageNum);
  } else if (doc.file_type === 'cbr') {
    return renderCbrPage(fullPath, cacheDir, pageNum);
  } else if (doc.file_type === 'cbz') {
    return renderCbzPage(fullPath, cacheDir, pageNum);
  } else {
    return Promise.reject(new Error('Unsupported file type: ' + doc.file_type));
  }
}

function renderPdfPage(pdfPath, cacheDir, pageNum) {
  var outputPrefix = path.join(cacheDir, 'temp');
  var escapedPath = shellEscape(pdfPath);

  // pdftoppm uses 1-based page numbers, outputs as prefix-NNNNNN.jpg
  var cmd = 'pdftoppm -jpeg -jpegopt quality=' + config.pageQuality +
    ' -r ' + config.pageDpi +
    ' -f ' + pageNum + ' -l ' + pageNum +
    ' "' + escapedPath + '" "' + outputPrefix + '"';

  return execAsync(cmd).then(function() {
    // pdftoppm creates files like temp-000001.jpg or temp-1.jpg
    // Find the generated file
    var files = fs.readdirSync(cacheDir).filter(function(f) {
      return f.startsWith('temp') && f.endsWith('.jpg');
    });

    if (files.length === 0) {
      throw new Error('pdftoppm produced no output');
    }

    // Rename to page number
    var generatedFile = path.join(cacheDir, files[0]);
    var finalPath = path.join(cacheDir, pageNum + '.jpg');
    fs.renameSync(generatedFile, finalPath);

    return finalPath;
  });
}

function renderCbzPage(cbzPath, cacheDir, pageNum) {
  var escapedPath = shellEscape(cbzPath);

  // List files in CBZ, filter to images, sort by name
  return execAsync('unzip -l "' + escapedPath + '"').then(function(stdout) {
    var lines = stdout.split('\n');
    var imageFiles = [];

    lines.forEach(function(line) {
      var match = line.match(/\d+\s+\d{2}-\d{2}-\d{2,4}\s+\d{2}:\d{2}\s+(.+)/);
      if (match) {
        var filename = match[1].trim();
        if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename) && !filename.startsWith('__MACOSX')) {
          imageFiles.push(filename);
        }
      }
    });

    imageFiles.sort();

    if (pageNum < 1 || pageNum > imageFiles.length) {
      throw new Error('Page ' + pageNum + ' out of range (1-' + imageFiles.length + ')');
    }

    var targetFile = imageFiles[pageNum - 1];
    var escapedTarget = shellEscape(targetFile);

    // Extract single file
    return execAsync('unzip -o -j "' + escapedPath + '" "' + escapedTarget + '" -d "' + cacheDir + '"')
      .then(function() {
        var extractedName = path.basename(targetFile);
        var extractedPath = path.join(cacheDir, extractedName);
        var finalPath = path.join(cacheDir, pageNum + '.jpg');

        // If it's already a JPEG, just rename
        if (/\.jpe?g$/i.test(extractedName)) {
          fs.renameSync(extractedPath, finalPath);
          return finalPath;
        }

        // Convert non-JPEG to JPEG using sharp
        var sharp = require('sharp');
        return sharp(extractedPath)
          .jpeg({ quality: config.pageQuality })
          .toFile(finalPath)
          .then(function() {
            fs.unlinkSync(extractedPath);
            return finalPath;
          });
      });
  });
}

function renderCbrPage(cbrPath, cacheDir, pageNum) {
  if (isZipFile(cbrPath)) {
    return renderCbzPage(cbrPath, cacheDir, pageNum);
  }

  var escapedPath = shellEscape(cbrPath);

  // List files in CBR, filter to images, sort by name
  return execAsync('unrar lb "' + escapedPath + '"').then(function(stdout) {
    var lines = stdout.split('\n');
    var imageFiles = [];

    lines.forEach(function(line) {
      var filename = line.trim();
      if (filename && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename) && filename.indexOf('__MACOSX') === -1) {
        imageFiles.push(filename);
      }
    });

    imageFiles.sort();

    if (pageNum < 1 || pageNum > imageFiles.length) {
      throw new Error('Page ' + pageNum + ' out of range (1-' + imageFiles.length + ')');
    }

    var targetFile = imageFiles[pageNum - 1];
    var escapedTarget = shellEscape(targetFile);

    // Extract single file to cache directory
    return execAsync('unrar e -o+ "' + escapedPath + '" "' + escapedTarget + '" "' + cacheDir + '/"')
      .then(function() {
        var extractedName = path.basename(targetFile);
        var extractedPath = path.join(cacheDir, extractedName);
        var finalPath = path.join(cacheDir, pageNum + '.jpg');

        if (/\.jpe?g$/i.test(extractedName)) {
          fs.renameSync(extractedPath, finalPath);
          return finalPath;
        }

        var sharp = require('sharp');
        return sharp(extractedPath)
          .jpeg({ quality: config.pageQuality })
          .toFile(finalPath)
          .then(function() {
            fs.unlinkSync(extractedPath);
            return finalPath;
          });
      });
  });
}

module.exports = { getPage };
