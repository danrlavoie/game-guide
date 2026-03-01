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
    return buf[0] === 0x50 && buf[1] === 0x4B;
  } catch (err) {
    return false;
  }
}

module.exports = { isZipFile };
