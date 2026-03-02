var express = require('express');
var router = express.Router();
var scanner = require('../services/scanner');
var log = require('../logger').child({ component: 'routes.scan' });

var scanning = false;

router.post('/scan', function(req, res) {
  if (scanning) {
    return res.status(409).json({ error: 'Scan already in progress' });
  }

  scanning = true;
  scanner.scan()
    .then(function(scanResult) {
      // Respond immediately with catalog results
      res.json(scanResult.result);

      // Background work continues; clear flag when done
      scanResult.backgroundWork.then(function() {
        scanning = false;
      }).catch(function() {
        scanning = false;
      });
    })
    .catch(function(err) {
      scanning = false;
      log.error({ err: err }, 'Scan failed');
      res.status(500).json({ error: 'Scan failed: ' + err.message });
    });
});

module.exports = router;
