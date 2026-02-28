var express = require('express');
var router = express.Router();
var scanner = require('../services/scanner');

var scanning = false;

router.post('/scan', function(req, res) {
  if (scanning) {
    return res.status(409).json({ error: 'Scan already in progress' });
  }

  scanning = true;
  scanner.scan()
    .then(function(result) {
      scanning = false;
      res.json(result);
    })
    .catch(function(err) {
      scanning = false;
      console.error('Scan error:', err);
      res.status(500).json({ error: 'Scan failed: ' + err.message });
    });
});

module.exports = router;
