var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var config = require('./config');
var { getDb } = require('./db');
var log = require('./logger').child({ component: 'server' });
var deviceMiddleware = require('./middleware/device');

var app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(deviceMiddleware);

// Static files
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    etag: false,
    lastModified: false,
    maxAge: 0,
  })
);

// API routes
app.use('/api/documents', require('./routes/documents'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/search', require('./routes/search'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api', require('./routes/scan'));

// Health check
app.get('/api/health', function (req, res) {
  res.json({
    status: 'ok',
    documentsPath: config.documentsPath,
    debugOsd: config.debugOsd,
  });
});

// SPA fallback - serve index.html for non-API routes
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Initialize database and start server
getDb();

app.listen(config.port, function () {
  log.info(
    {
      port: config.port,
      documentsPath: config.documentsPath,
      dataPath: config.dataPath,
    },
    'Server started'
  );

  // Run initial scan on startup
  var scanner = require('./services/scanner');
  scanner
    .scan()
    .then(function (scanResult) {
      var r = scanResult.result;
      log.info(
        { added: r.added, updated: r.updated, removed: r.removed },
        'Initial scan complete'
      );
      // Background work (page counts + thumbnails) continues asynchronously
      return scanResult.backgroundWork;
    })
    .catch(function (err) {
      log.error({ err: err }, 'Initial scan failed');
    });
});

module.exports = app;
