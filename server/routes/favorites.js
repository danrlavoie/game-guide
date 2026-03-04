var express = require('express');
var router = express.Router();
var { getDb } = require('../db');

// List all favorites for current device
router.get('/', function (req, res) {
  var db = getDb();

  var rows = db
    .prepare(
      '\
    SELECT d.*, f.created_at as favorited_at \
    FROM favorites f \
    JOIN documents d ON d.id = f.document_id \
    WHERE f.device_id = ? \
    ORDER BY f.created_at DESC\
  '
    )
    .all(req.deviceId);

  if (rows.length > 0) {
    var docIds = rows.map(function (d) {
      return d.id;
    });
    var placeholders = docIds
      .map(function () {
        return '?';
      })
      .join(',');

    // Attach reading progress
    var progressStmt = db.prepare(
      '\
      SELECT document_id, current_page, last_read_at \
      FROM reading_progress \
      WHERE device_id = ? AND document_id IN (' +
        placeholders +
        ')\
    '
    );
    var progress = progressStmt.all.apply(
      progressStmt,
      [req.deviceId].concat(docIds)
    );
    var progressMap = {};
    progress.forEach(function (p) {
      progressMap[p.document_id] = p;
    });

    // Attach bookmark counts
    var bmStmt = db.prepare(
      '\
      SELECT document_id, COUNT(*) as cnt \
      FROM bookmarks \
      WHERE device_id = ? AND document_id IN (' +
        placeholders +
        ') \
      GROUP BY document_id\
    '
    );
    var bmRows = bmStmt.all.apply(bmStmt, [req.deviceId].concat(docIds));
    var bmMap = {};
    bmRows.forEach(function (r) {
      bmMap[r.document_id] = r.cnt;
    });

    rows = rows.map(function (doc) {
      var p = progressMap[doc.id];
      doc.current_page = p ? p.current_page : null;
      doc.last_read = p ? p.last_read_at : null;
      doc.bookmark_count = bmMap[doc.id] || 0;
      doc.is_favorite = true;
      return doc;
    });
  }

  res.json({ documents: rows });
});

module.exports = router;
