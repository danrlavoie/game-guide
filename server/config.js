var path = require('path');

var config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  documentsPath: process.env.DOCUMENTS_PATH || '/documents',
  dataPath: process.env.DATA_PATH || path.join(__dirname, '..', 'data'),
  pageDpi: parseInt(process.env.PAGE_DPI, 10) || 150,
  thumbnailWidth: parseInt(process.env.THUMBNAIL_WIDTH, 10) || 200,
  scanIntervalMinutes: parseInt(process.env.SCAN_INTERVAL, 10) || 0,
  pageQuality: parseInt(process.env.PAGE_QUALITY, 10) || 85,
  debugOsd: process.env.DEBUG_OSD === '1' || process.env.DEBUG_OSD === 'true',
};

// Derived paths
config.dbPath = path.join(config.dataPath, 'game-guide.db');
config.pagesPath = path.join(config.dataPath, 'pages');
config.thumbnailsPath = path.join(config.dataPath, 'thumbnails');

module.exports = config;
