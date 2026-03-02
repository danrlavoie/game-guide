var express = require('express');
var path = require('path');
var fs = require('fs');
var router = express.Router();
var { getDb } = require('../db');
var config = require('../config');
var renderer = require('../services/renderer');
var thumbnail = require('../services/thumbnail');
var log = require('../logger').child({ component: 'routes.documents' });

// List documents and subfolders
router.get('/', function(req, res) {
  var db = getDb();

  // Recently viewed
  if (req.query.recent === 'true') {
    var limit = parseInt(req.query.limit, 10) || 5;
    var rows = db.prepare('\
      SELECT d.*, rp.current_page, rp.last_read_at as last_read \
      FROM reading_progress rp \
      JOIN documents d ON d.id = rp.document_id \
      WHERE rp.device_id = ? \
      ORDER BY rp.last_read_at DESC \
      LIMIT ?\
    ').all(req.deviceId, limit);
    return res.json({ documents: rows });
  }

  var folder = req.query.folder || '';
  var page = parseInt(req.query.page, 10) || 1;
  var limit = parseInt(req.query.limit, 10) || 50;
  var offset = (page - 1) * limit;

  // Get subfolders at this level
  var subfolders = db.prepare('\
    SELECT DISTINCT \
      CASE \
        WHEN parent_folder = ? THEN file_name \
        ELSE substr(file_path, length(?) + 2, \
          instr(substr(file_path, length(?) + 2), \'/\') - 1) \
      END as name \
    FROM documents \
    WHERE file_path LIKE ? AND parent_folder != ? \
    AND instr(substr(file_path, length(?) + 2), \'/\') > 0 \
    GROUP BY name \
    ORDER BY name\
  ').all(folder, folder, folder, folder + '%', folder, folder);

  // Actually, let's do this more simply
  // Get unique immediate child folders
  var allDocs = db.prepare('\
    SELECT parent_folder FROM documents WHERE parent_folder LIKE ? \
    GROUP BY parent_folder\
  ').all(folder + '%');

  var folderSet = {};
  var prefix = folder ? folder + '/' : '';
  allDocs.forEach(function(row) {
    var relative = row.parent_folder;
    if (relative === folder) return; // Same folder, not a subfolder
    var afterPrefix = folder ? relative.substring(prefix.length) : relative;
    if (!afterPrefix) return;
    var firstPart = afterPrefix.split('/')[0];
    if (firstPart) {
      folderSet[firstPart] = true;
    }
  });

  var folders = Object.keys(folderSet).sort().map(function(name) {
    return { name: name, path: prefix + name };
  });

  // Get documents in this exact folder
  var documents = db.prepare('\
    SELECT * FROM documents \
    WHERE parent_folder = ? \
    ORDER BY file_name \
    LIMIT ? OFFSET ?\
  ').all(folder, limit, offset);

  var total = db.prepare('\
    SELECT COUNT(*) as count FROM documents WHERE parent_folder = ?\
  ').get(folder);

  // Get reading progress for this device
  if (documents.length > 0) {
    var docIds = documents.map(function(d) { return d.id; });
    var placeholders = docIds.map(function() { return '?'; }).join(',');
    var stmt = db.prepare('\
      SELECT document_id, current_page, last_read_at \
      FROM reading_progress \
      WHERE device_id = ? AND document_id IN (' + placeholders + ')\
    ');
    var progress = stmt.all.apply(stmt, [req.deviceId].concat(docIds));

    var progressMap = {};
    progress.forEach(function(p) {
      progressMap[p.document_id] = p;
    });

    documents = documents.map(function(doc) {
      var p = progressMap[doc.id];
      doc.current_page = p ? p.current_page : null;
      doc.last_read = p ? p.last_read_at : null;
      return doc;
    });
  }

  res.json({
    folder: folder,
    folders: folders,
    documents: documents,
    total: total.count,
    page: page,
    limit: limit,
  });
});

// Document detail
router.get('/:id', function(req, res) {
  var db = getDb();
  var doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Get progress for this device
  var progress = db.prepare('\
    SELECT current_page, last_read_at \
    FROM reading_progress \
    WHERE device_id = ? AND document_id = ?\
  ').get(req.deviceId, doc.id);

  doc.current_page = progress ? progress.current_page : null;
  doc.last_read = progress ? progress.last_read_at : null;

  res.json(doc);
});

// Get/save reading progress
router.get('/:id/progress', function(req, res) {
  var db = getDb();
  var progress = db.prepare('\
    SELECT current_page, last_read_at \
    FROM reading_progress \
    WHERE device_id = ? AND document_id = ?\
  ').get(req.deviceId, req.params.id);

  res.json(progress || { current_page: 1, last_read_at: null });
});

router.put('/:id/progress', function(req, res) {
  var db = getDb();
  var doc = db.prepare('SELECT file_type FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  var currentPage = parseInt(req.body.current_page, 10);
  var minValid = doc.file_type === 'txt' ? 0 : 1;
  if (isNaN(currentPage) || currentPage < minValid) {
    return res.status(400).json({ error: 'Invalid progress value' });
  }

  db.prepare('\
    INSERT INTO reading_progress (device_id, document_id, current_page, last_read_at) \
    VALUES (?, ?, ?, datetime(\'now\')) \
    ON CONFLICT(device_id, document_id) DO UPDATE SET \
      current_page = excluded.current_page, \
      last_read_at = datetime(\'now\')\
  ').run(req.deviceId, req.params.id, currentPage);

  res.json({ current_page: currentPage });
});

// Render a page
router.get('/:id/pages/:pageNum', function(req, res) {
  var db = getDb();
  var doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  var pageNum = parseInt(req.params.pageNum, 10);
  if (pageNum < 1 || pageNum > doc.page_count) {
    return res.status(400).json({ error: 'Page out of range' });
  }

  var fullPath = path.join(config.documentsPath, doc.file_path);

  renderer.getPage(doc, fullPath, pageNum)
    .then(function(pagePath) {
      res.sendFile(pagePath);
    })
    .catch(function(err) {
      log.error({ err: err, docId: req.params.id, page: pageNum }, 'Page render failed');
      res.status(500).json({ error: 'Failed to render page' });
    });
});

// Get thumbnail
router.get('/:id/thumbnail', function(req, res) {
  var db = getDb();
  var doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (doc.file_type === 'txt') {
    return res.status(404).json({ error: 'No thumbnail for text files' });
  }

  var fullPath = path.join(config.documentsPath, doc.file_path);

  thumbnail.getThumbnail(doc, fullPath)
    .then(function(thumbPath) {
      res.sendFile(thumbPath);
    })
    .catch(function(err) {
      log.error({ err: err, docId: req.params.id }, 'Thumbnail generation failed');
      res.status(500).json({ error: 'Failed to generate thumbnail' });
    });
});

// Serve text file content
router.get('/:id/content', function(req, res) {
  var db = getDb();
  var doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (doc.file_type !== 'txt') {
    return res.status(400).json({ error: 'Document is not a text file' });
  }

  var fullPath = path.join(config.documentsPath, doc.file_path);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(fullPath);
});

// Download original file
router.get('/:id/download', function(req, res) {
  var db = getDb();
  var doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  var fullPath = path.join(config.documentsPath, doc.file_path);
  res.download(fullPath, doc.file_name);
});

module.exports = router;
