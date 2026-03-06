var Toolbar = (function () {
  function create(options) {
    var el = document.createElement('div');
    el.className = 'viewer-toolbar';

    var left = document.createElement('div');
    left.className = 'viewer-toolbar-left';

    var backBtn = document.createElement('button');
    backBtn.className = 'viewer-back-btn';
    backBtn.innerHTML = '<i class="fa fa-arrow-left"></i> Back';
    backBtn.addEventListener('click', function () {
      if (options.onBack) options.onBack();
    });
    left.appendChild(backBtn);

    var center = document.createElement('div');
    center.className = 'viewer-toolbar-center';

    var pageInfo = document.createElement('span');
    pageInfo.className = 'viewer-page-info';

    var pageInput = document.createElement('input');
    pageInput.className = 'viewer-page-input';
    pageInput.type = 'number';
    pageInput.min = '1';
    pageInput.max = String(options.totalPages || 1);
    pageInput.value = String(options.currentPage || 1);

    var totalLabel = document.createElement('span');
    totalLabel.className = 'viewer-page-info';
    totalLabel.textContent = ' / ' + (options.totalPages || 1);

    pageInput.addEventListener('change', function () {
      var val = parseInt(pageInput.value, 10);
      if (val >= 1 && val <= options.totalPages && options.onPageChange) {
        options.onPageChange(val);
      }
    });

    // Prevent keyboard from messing with page on blur
    pageInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        pageInput.blur();
      }
    });

    center.appendChild(pageInput);
    center.appendChild(totalLabel);

    var right = document.createElement('div');
    right.className = 'viewer-toolbar-right';

    // Spread toggle button [1|2]
    var spreadBtn = document.createElement('button');
    spreadBtn.className = 'viewer-spread-btn';
    var spreadMode = options.spreadMode || 'single';
    updateSpreadBtn(spreadBtn, spreadMode);
    spreadBtn.addEventListener('click', function () {
      if (options.onSpreadToggle) options.onSpreadToggle();
    });
    right.appendChild(spreadBtn);

    // Alignment toggle button [L|R]
    var alignBtn = document.createElement('button');
    alignBtn.className = 'viewer-align-btn';
    var page1Side = options.page1Side || 'left';
    updateAlignBtn(alignBtn, page1Side);
    if (spreadMode !== 'spread') {
      alignBtn.style.display = 'none';
    }
    alignBtn.addEventListener('click', function () {
      if (options.onAlignToggle) options.onAlignToggle();
    });
    right.appendChild(alignBtn);

    // Favorite toggle button (heart)
    var favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'viewer-favorite-btn';
    favoriteBtn.innerHTML = '<i class="fa fa-heart-o"></i>';
    favoriteBtn.title = 'Favorite this document';
    if (options.isFavorited) {
      favoriteBtn.innerHTML = '<i class="fa fa-heart"></i>';
      favoriteBtn.classList.add('active');
    }
    favoriteBtn.addEventListener('click', function () {
      if (options.onFavoriteToggle) options.onFavoriteToggle();
    });
    right.appendChild(favoriteBtn);

    // Bookmark toggle button (star)
    var bookmarkBtn = document.createElement('button');
    bookmarkBtn.className = 'viewer-bookmark-btn';
    bookmarkBtn.innerHTML = '<i class="fa fa-star-o"></i>';
    bookmarkBtn.title = 'Bookmark this page';
    bookmarkBtn.addEventListener('click', function () {
      if (options.onBookmarkToggle) options.onBookmarkToggle();
    });
    right.appendChild(bookmarkBtn);

    // Bookmarks list toggle button
    var bookmarksListBtn = document.createElement('button');
    bookmarksListBtn.className = 'viewer-bookmarks-list-btn';
    bookmarksListBtn.innerHTML = '<i class="fa fa-bars"></i>';
    bookmarksListBtn.title = 'View bookmarks';
    bookmarksListBtn.addEventListener('click', function () {
      if (options.onBookmarksListToggle) options.onBookmarksListToggle();
    });
    right.appendChild(bookmarksListBtn);

    var downloadBtn = document.createElement('a');
    downloadBtn.className = 'viewer-download-btn';
    downloadBtn.innerHTML = '<i class="fa fa-download"></i> Download';
    downloadBtn.href = options.downloadUrl || '#';
    right.appendChild(downloadBtn);

    el.appendChild(left);
    el.appendChild(center);
    el.appendChild(right);

    function updateSpreadBtn(btn, mode) {
      btn.innerHTML = '';
      var label1 = document.createElement('span');
      label1.textContent = '1';
      label1.className =
        mode === 'single' ? 'toggle-option active' : 'toggle-option';
      var sep = document.createElement('span');
      sep.textContent = '|';
      sep.className = 'toggle-sep';
      var label2 = document.createElement('span');
      label2.textContent = '2';
      label2.className =
        mode === 'spread' ? 'toggle-option active' : 'toggle-option';
      btn.appendChild(label1);
      btn.appendChild(sep);
      btn.appendChild(label2);
    }

    function updateAlignBtn(btn, side) {
      btn.innerHTML = '';
      var labelL = document.createElement('span');
      labelL.textContent = 'L';
      labelL.className =
        side === 'left' ? 'toggle-option active' : 'toggle-option';
      var sep = document.createElement('span');
      sep.textContent = '|';
      sep.className = 'toggle-sep';
      var labelR = document.createElement('span');
      labelR.textContent = 'R';
      labelR.className =
        side === 'right' ? 'toggle-option active' : 'toggle-option';
      btn.appendChild(labelL);
      btn.appendChild(sep);
      btn.appendChild(labelR);
    }

    return {
      el: el,
      setPage: function (page) {
        pageInput.value = String(page);
      },
      setSpreadMode: function (mode) {
        updateSpreadBtn(spreadBtn, mode);
        alignBtn.style.display = mode === 'spread' ? '' : 'none';
      },
      setPage1Side: function (side) {
        updateAlignBtn(alignBtn, side);
      },
      setFavorited: function (isFavorited) {
        favoriteBtn.innerHTML = isFavorited
          ? '<i class="fa fa-heart"></i>'
          : '<i class="fa fa-heart-o"></i>';
        if (isFavorited) {
          favoriteBtn.classList.add('active');
        } else {
          favoriteBtn.classList.remove('active');
        }
      },
      setBookmarked: function (isBookmarked) {
        bookmarkBtn.innerHTML = isBookmarked
          ? '<i class="fa fa-star"></i>'
          : '<i class="fa fa-star-o"></i>';
        if (isBookmarked) {
          bookmarkBtn.classList.add('active');
        } else {
          bookmarkBtn.classList.remove('active');
        }
      },
      show: function () {
        el.classList.remove('hidden');
      },
      hide: function () {
        el.classList.add('hidden');
      },
      toggle: function () {
        el.classList.toggle('hidden');
      },
      isHidden: function () {
        return el.classList.contains('hidden');
      },
    };
  }

  return { create: create };
})();
