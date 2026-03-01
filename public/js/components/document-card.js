var DocumentCard = (function() {

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function create(doc) {
    var card = document.createElement('div');
    card.className = 'doc-card';
    card.setAttribute('data-id', doc.id);

    var thumbHtml = '<div class="doc-card-thumb">' +
      '<img src="' + API.getThumbnailUrl(doc.id) + '" alt="" ' +
      'onerror="this.parentNode.innerHTML=\'<span class=placeholder>' +
      (doc.file_type.toUpperCase()) + '</span>\'">' +
      '</div>';

    var progressHtml = '';
    if (doc.current_page && doc.page_count) {
      var pct = Math.round((doc.current_page / doc.page_count) * 100);
      progressHtml = '<div class="doc-card-progress">' +
        '<div class="doc-card-progress-bar" style="width:' + pct + '%"></div>' +
        '</div>';
    }

    card.innerHTML = thumbHtml +
      '<div class="doc-card-info">' +
        '<div class="doc-card-title" title="' + escapeHtml(doc.file_name) + '">' +
          escapeHtml(doc.file_name) +
        '</div>' +
        '<div class="doc-card-meta">' +
          '<span>' + (doc.page_count || '?') + ' pages</span>' +
          '<span>' + formatSize(doc.file_size) + '</span>' +
        '</div>' +
      '</div>' +
      progressHtml;

    card.addEventListener('click', function() {
      window.location.hash = '#/view/' + doc.id;
    });

    return card;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { create: create };
})();
