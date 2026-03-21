var fs = require('fs');
var path = require('path');
var config = require('../config');
var { execAsync, shellEscape } = require('../utils/exec');
var {
  isZipFile,
  isRarFile,
  findImagesBufferSafe,
} = require('../utils/archive');

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
  var cmd =
    'pdftoppm -jpeg -jpegopt quality=' +
    config.pageQuality +
    ' -r ' +
    config.pageDpi +
    ' -f ' +
    pageNum +
    ' -l ' +
    pageNum +
    ' "' +
    escapedPath +
    '" "' +
    outputPrefix +
    '"';

  return execAsync(cmd).then(function () {
    // pdftoppm creates files like temp-000001.jpg or temp-1.jpg
    // Find the generated file
    var files = fs.readdirSync(cacheDir).filter(function (f) {
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
  if (isRarFile(cbzPath)) {
    return renderCbrPage(cbzPath, cacheDir, pageNum);
  }

  var escapedPath = shellEscape(cbzPath);

  // List files in CBZ, filter to images, sort by name
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
      throw new Error(
        'No images found in CBZ (parsed 0 image entries from ' +
          lines.length +
          ' listing lines)'
      );
    }

    if (pageNum < 1 || pageNum > imageFiles.length) {
      throw new Error(
        'Page ' + pageNum + ' out of range (1-' + imageFiles.length + ')'
      );
    }

    var targetFile = imageFiles[pageNum - 1];
    var escapedTarget = shellEscape(targetFile);

    // Extract single file to a temp subdir to isolate from cached pages
    var extractDir = path.join(
      cacheDir,
      'tmp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
    );
    fs.mkdirSync(extractDir, { recursive: true });

    return execAsync(
      'unzip -o -j "' +
        escapedPath +
        '" "' +
        escapedTarget +
        '" -d "' +
        extractDir +
        '"'
    )
      .catch(function () {
        // Exit code 1 = warning (e.g. Unicode issues) but file may have extracted
        if (findImagesBufferSafe(extractDir).length > 0) return;
        // Filename encoding mismatch — extract all and pick the right page
        return execAsync(
          'unzip -o -j "' + escapedPath + '" -d "' + extractDir + '"'
        );
      })
      .then(function () {
        var images = findImagesBufferSafe(extractDir);
        if (images.length === 0) {
          fs.rmSync(extractDir, { recursive: true, force: true });
          throw new Error('No images extracted from CBZ');
        }

        // When fallback extracted all files, pick the right page
        var image = images.length === 1 ? images[0] : images[pageNum - 1];
        var finalPath = path.join(cacheDir, pageNum + '.jpg');

        // If it's already a JPEG, read and write to final path
        if (/\.jpe?g$/i.test(image.ext)) {
          fs.writeFileSync(finalPath, fs.readFileSync(image.bufPath));
          fs.rmSync(extractDir, { recursive: true, force: true });
          return finalPath;
        }

        // Convert non-JPEG to JPEG using sharp
        var sharp = require('sharp');
        return sharp(fs.readFileSync(image.bufPath))
          .jpeg({ quality: config.pageQuality })
          .toFile(finalPath)
          .then(function () {
            fs.rmSync(extractDir, { recursive: true, force: true });
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
      throw new Error(
        'No images found in CBR (parsed 0 image entries from ' +
          lines.length +
          ' listing lines)'
      );
    }

    if (pageNum < 1 || pageNum > imageFiles.length) {
      throw new Error(
        'Page ' + pageNum + ' out of range (1-' + imageFiles.length + ')'
      );
    }

    var targetFile = imageFiles[pageNum - 1];
    var escapedTarget = shellEscape(targetFile);

    // Extract single file to a temp subdir to isolate from cached pages
    var extractDir = path.join(
      cacheDir,
      'tmp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8)
    );
    fs.mkdirSync(extractDir, { recursive: true });

    return execAsync(
      'unrar e -o+ "' +
        escapedPath +
        '" "' +
        escapedTarget +
        '" "' +
        extractDir +
        '/"'
    ).then(function () {
      var images = findImagesBufferSafe(extractDir);
      if (images.length === 0) {
        fs.rmSync(extractDir, { recursive: true, force: true });
        throw new Error('No images extracted from CBR');
      }

      var image = images[0];
      var finalPath = path.join(cacheDir, pageNum + '.jpg');

      if (/\.jpe?g$/i.test(image.ext)) {
        fs.writeFileSync(finalPath, fs.readFileSync(image.bufPath));
        fs.rmSync(extractDir, { recursive: true, force: true });
        return finalPath;
      }

      var sharp = require('sharp');
      return sharp(fs.readFileSync(image.bufPath))
        .jpeg({ quality: config.pageQuality })
        .toFile(finalPath)
        .then(function () {
          fs.rmSync(extractDir, { recursive: true, force: true });
          return finalPath;
        });
    });
  });
}

module.exports = { getPage };
