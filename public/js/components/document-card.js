var DocumentCard = (function () {
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function create(doc) {
    var card = document.createElement('div');
    card.className = 'doc-card';
    card.setAttribute('data-id', doc.id);

    var bookmarkBadge = '';
    if (doc.bookmark_count > 0) {
      bookmarkBadge =
        '<span class="doc-card-bookmark-badge"><i class="fa fa-bookmark"></i></span>';
    }

    var thumbHtml =
      '<div class="doc-card-thumb">' +
      '<img src="' +
      API.getThumbnailUrl(doc.id) +
      '" alt="" ' +
      'onerror="this.parentNode.innerHTML=\'<span class=placeholder>' +
      doc.file_type.toUpperCase() +
      '</span>\'">' +
      '<button class="doc-card-favorite-btn' +
      (doc.is_favorite ? ' active' : '') +
      '" data-doc-id="' +
      doc.id +
      '">' +
      (doc.is_favorite
        ? '<i class="fa fa-heart"></i>'
        : '<i class="fa fa-heart-o"></i>') +
      '</button>' +
      bookmarkBadge +
      '</div>';

    var progressHtml = '';
    if (doc.file_type === 'txt') {
      if (doc.current_page && doc.current_page > 0) {
        var pct = Math.round(doc.current_page / 100);
        progressHtml =
          '<div class="doc-card-progress">' +
          '<div class="doc-card-progress-bar" style="width:' +
          pct +
          '%"></div>' +
          '</div>';
      }
    } else if (doc.current_page && doc.page_count) {
      pct = Math.round((doc.current_page / doc.page_count) * 100);
      progressHtml =
        '<div class="doc-card-progress">' +
        '<div class="doc-card-progress-bar" style="width:' +
        pct +
        '%"></div>' +
        '</div>';
    }

    var metaPages =
      doc.file_type === 'txt' ? 'Text' : (doc.page_count || '?') + ' pages';

    card.innerHTML =
      thumbHtml +
      '<div class="doc-card-info">' +
      '<div class="doc-card-title" title="' +
      escapeHtml(doc.file_name) +
      '">' +
      escapeHtml(doc.file_name) +
      '</div>' +
      '<div class="doc-card-meta">' +
      '<span>' +
      metaPages +
      '</span>' +
      '<span>' +
      formatSize(doc.file_size) +
      '</span>' +
      '</div>' +
      '</div>' +
      progressHtml;

    card.addEventListener('click', function () {
      window.location.hash =
        doc.file_type === 'txt' ? '#/read/' + doc.id : '#/view/' + doc.id;
    });

    var favBtn = card.querySelector('.doc-card-favorite-btn');
    if (favBtn) {
      favBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isActive = favBtn.classList.contains('active');
        var promise = isActive
          ? API.removeFavorite(doc.id)
          : API.addFavorite(doc.id);
        promise
          .then(function () {
            if (isActive) {
              favBtn.classList.remove('active');
              favBtn.innerHTML = '<i class="fa fa-heart-o"></i>';
            } else {
              favBtn.classList.add('active');
              favBtn.innerHTML = '<i class="fa fa-heart"></i>';
            }
          })
          .catch(function () {});
      });
    }

    return card;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { create: create };
})();
