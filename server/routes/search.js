var express = require('express');
var router = express.Router();
var { getDb } = require('../db');

router.get('/', function (req, res) {
  var q = req.query.q;
  if (!q || q.length < 2) {
    return res.json({ documents: [] });
  }

  var db = getDb();
  var limit = parseInt(req.query.limit, 10) || 50;
  var page = parseInt(req.query.page, 10) || 1;
  var offset = (page - 1) * limit;
  var searchTerm = '%' + q + '%';

  var total = db
    .prepare(
      '\
    SELECT COUNT(*) as count FROM documents \
    WHERE file_name LIKE ? OR file_path LIKE ?\
  '
    )
    .get(searchTerm, searchTerm).count;

  var documents = db
    .prepare(
      '\
    SELECT * FROM documents \
    WHERE file_name LIKE ? OR file_path LIKE ? \
    ORDER BY file_name \
    LIMIT ? OFFSET ?\
  '
    )
    .all(searchTerm, searchTerm, limit, offset);

  // Get reading progress for results
  if (documents.length > 0) {
    var docIds = documents.map(function (d) {
      return d.id;
    });
    var placeholders = docIds
      .map(function () {
        return '?';
      })
      .join(',');
    var stmt = db.prepare(
      '\
      SELECT document_id, current_page, last_read_at \
      FROM reading_progress \
      WHERE device_id = ? AND document_id IN (' +
        placeholders +
        ')\
    '
    );
    var progress = stmt.all.apply(stmt, [req.deviceId].concat(docIds));

    var progressMap = {};
    progress.forEach(function (p) {
      progressMap[p.document_id] = p;
    });

    documents = documents.map(function (doc) {
      var p = progressMap[doc.id];
      doc.current_page = p ? p.current_page : null;
      doc.last_read = p ? p.last_read_at : null;
      return doc;
    });

    // Attach is_favorite
    var favStmt = db.prepare(
      'SELECT document_id FROM favorites WHERE device_id = ? AND document_id IN (' +
        placeholders +
        ')'
    );
    var favRows = favStmt.all.apply(favStmt, [req.deviceId].concat(docIds));
    var favSet = {};
    favRows.forEach(function (r) {
      favSet[r.document_id] = true;
    });
    documents = documents.map(function (doc) {
      doc.is_favorite = !!favSet[doc.id];
      return doc;
    });
  }

  res.json({
    documents: documents,
    query: q,
    total: total,
    page: page,
    limit: limit,
  });
});

module.exports = router;
