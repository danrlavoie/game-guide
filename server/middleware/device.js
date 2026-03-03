var { v4: uuidv4 } = require('uuid');
var { getDb } = require('../db');

var COOKIE_NAME = 'game_guide_device_id';
var COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years

function deviceMiddleware(req, res, next) {
  var db = getDb();
  var deviceId = req.cookies[COOKIE_NAME];

  if (!deviceId) {
    deviceId = uuidv4();
    res.cookie(COOKIE_NAME, deviceId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  // Upsert device record
  var ip = req.ip || req.connection.remoteAddress;
  var ua = req.headers['user-agent'] || '';

  db.prepare(
    "\
    INSERT INTO devices (id, ip_address, user_agent, last_seen_at) \
    VALUES (?, ?, ?, datetime('now')) \
    ON CONFLICT(id) DO UPDATE SET \
      ip_address = excluded.ip_address, \
      user_agent = excluded.user_agent, \
      last_seen_at = datetime('now')\
  "
  ).run(deviceId, ip, ua);

  req.deviceId = deviceId;
  next();
}

module.exports = deviceMiddleware;
