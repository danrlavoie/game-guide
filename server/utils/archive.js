var fs = require('fs');

/**
 * Detect if a file is actually a ZIP archive by checking magic bytes.
 * Many .cbr files are mislabeled ZIPs (magic bytes 'PK' / 0x504B).
 */
function isZipFile(filePath) {
  try {
    var fd = fs.openSync(filePath, 'r');
    var buf = Buffer.alloc(2);
    fs.readSync(fd, buf, 0, 2, 0);
    fs.closeSync(fd);
    return buf[0] === 0x50 && buf[1] === 0x4b;
  } catch (_err) {
    return false;
  }
}

/**
 * Detect if a file is actually a RAR archive by checking magic bytes.
 * Some .cbz files are mislabeled RARs (magic bytes 'Rar!' / 0x52617221).
 */
function isRarFile(filePath) {
  try {
    var fd = fs.openSync(filePath, 'r');
    var buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return (
      buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21
    );
  } catch (_err) {
    return false;
  }
}

/**
 * Find image files in a directory using buffer-based readdirSync.
 * Returns sorted array of { bufPath: Buffer, ext: string } objects.
 *
 * Standard string-based readdirSync cannot round-trip non-UTF-8 filenames
 * (e.g. Latin-1 encoded names in archives) under POSIX locale. Buffer-based
 * reading preserves the raw bytes so fs operations resolve correctly.
 */
function findImagesBufferSafe(dir) {
  var entries = fs.readdirSync(dir, { encoding: 'buffer' });
  var dirBuf = Buffer.from(dir + '/');

  var images = [];
  entries.forEach(function (entry) {
    // Decode as latin1 for extension/name checks — every byte maps 1:1
    var name = entry.toString('latin1');
    if (
      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name) &&
      name.indexOf('__MACOSX') === -1
    ) {
      images.push({
        bufPath: Buffer.concat([dirBuf, entry]),
        ext: name.match(/\.[^.]+$/)[0],
      });
    }
  });

  images.sort(function (a, b) {
    return a.bufPath.compare(b.bufPath);
  });

  return images;
}

module.exports = { isZipFile, isRarFile, findImagesBufferSafe };
