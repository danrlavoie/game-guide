var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var config = require('./config');
var { getDb } = require('./db');
var deviceMiddleware = require('./middleware/device');

var app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(deviceMiddleware);

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/documents', require('./routes/documents'));
app.use('/api/search', require('./routes/search'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api', require('./routes/scan'));

// Health check
app.get('/api/health', function(req, res) {
  res.json({ status: 'ok', documentsPath: config.documentsPath });
});

// SPA fallback - serve index.html for non-API routes
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Initialize database and start server
getDb();

app.listen(config.port, function() {
  console.log('Game Guide server listening on port ' + config.port);
  console.log('Documents path: ' + config.documentsPath);
  console.log('Data path: ' + config.dataPath);

  // Run initial scan on startup
  var scanner = require('./services/scanner');
  scanner.scan().then(function(result) {
    console.log('Initial scan complete: ' + result.added + ' added, ' +
      result.updated + ' updated, ' + result.removed + ' removed');
  }).catch(function(err) {
    console.error('Initial scan failed:', err.message);
  });
});

module.exports = app;
