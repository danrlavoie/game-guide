var childProcess = require('child_process');

function execAsync(command, options) {
  return new Promise(function (resolve, reject) {
    childProcess.exec(
      command,
      Object.assign({ maxBuffer: 10 * 1024 * 1024 }, options),
      function (err, stdout, _stderr) {
        if (err) {
          reject(err);
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

// Escape a string for safe use inside double quotes in a shell command.
// child_process.exec uses /bin/sh -c, where only $ ` " \ are special
// inside double quotes. (! is only special in interactive bash, not /bin/sh)
function shellEscape(str) {
  return str.replace(/([\\$`"])/g, '\\$1');
}

module.exports = { execAsync, shellEscape };
