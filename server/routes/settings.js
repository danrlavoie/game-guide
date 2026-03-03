var express = require('express');
var router = express.Router();
var { getDb } = require('../db');

// GET /api/settings - return all settings for current device
router.get('/', function (req, res) {
  var db = getDb();
  var rows = db
    .prepare(
      'SELECT setting_key, setting_value FROM device_settings WHERE device_id = ?'
    )
    .all(req.deviceId);

  var settings = {};
  rows.forEach(function (row) {
    settings[row.setting_key] = row.setting_value;
  });

  res.json(settings);
});

// PUT /api/settings - upsert a single setting
router.put('/', function (req, res) {
  var key = req.body.key;
  var value = req.body.value;

  if (!key || value === undefined || value === null) {
    return res.status(400).json({ error: 'key and value are required' });
  }

  var db = getDb();
  db.prepare(
    'INSERT INTO device_settings (device_id, setting_key, setting_value, updated_at) ' +
      "VALUES (?, ?, ?, datetime('now')) " +
      "ON CONFLICT (device_id, setting_key) DO UPDATE SET setting_value = ?, updated_at = datetime('now')"
  ).run(req.deviceId, key, String(value), String(value));

  // Return full settings
  var rows = db
    .prepare(
      'SELECT setting_key, setting_value FROM device_settings WHERE device_id = ?'
    )
    .all(req.deviceId);

  var settings = {};
  rows.forEach(function (row) {
    settings[row.setting_key] = row.setting_value;
  });

  res.json(settings);
});

module.exports = router;
