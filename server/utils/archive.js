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

module.exports = { isZipFile, isRarFile };
