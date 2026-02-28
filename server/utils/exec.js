var childProcess = require('child_process');

function execAsync(command, options) {
  return new Promise(function(resolve, reject) {
    childProcess.exec(command, Object.assign({ maxBuffer: 10 * 1024 * 1024 }, options), function(err, stdout, stderr) {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

module.exports = { execAsync };
