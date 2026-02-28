var ViewerPage = (function() {

  var doc = null;
  var currentPage = 1;
  var totalPages = 0;
  var toolbar = null;
  var progressBar = null;
  var pageContainer = null;
  var saveTimer = null;
  var preloadedImages = {};

  function render(container, docId) {
    container.innerHTML = '<div class="viewer"><div class="viewer-loading">Loading...</div></div>';

    API.getDocument(docId).then(function(data) {
      doc = data;
      totalPages = doc.page_count;
      currentPage = doc.current_page || 1;

      buildViewer(container);
      showPage(currentPage);
    }).catch(function(err) {
      container.innerHTML = '<div class="page"><div class="empty-state">' +
        '<p>Error loading document.</p>' +
        '<a href="#/" class="btn" style="margin-top:16px">Go Home</a>' +
        '</div></div>';
    });
  }

  function buildViewer(container) {
    var viewer = document.createElement('div');
    viewer.className = 'viewer';

    // Toolbar
    toolbar = Toolbar.create({
      currentPage: currentPage,
      totalPages: totalPages,
      downloadUrl: API.getDownloadUrl(doc.id),
      onBack: function() {
        cleanup();
        window.history.back();
      },
      onPageChange: function(page) {
        goToPage(page);
      },
    });
    viewer.appendChild(toolbar.el);

    // Page container
    pageContainer = document.createElement('div');
    pageContainer.className = 'viewer-page-container';
    viewer.appendChild(pageContainer);

    // Touch handling
    TouchHandler.create(pageContainer, {
      onTapLeft: function() { prevPage(); },
      onTapRight: function() { nextPage(); },
      onTapCenter: function() { toolbar.toggle(); },
      onSwipeLeft: function() { nextPage(); },
      onSwipeRight: function() { prevPage(); },
    });

    // Progress bar
    progressBar = ProgressBar.create();
    viewer.appendChild(progressBar.el);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);

    container.innerHTML = '';
    container.appendChild(viewer);
  }

  function showPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages || !pageContainer) return;

    currentPage = pageNum;

    // Update toolbar
    if (toolbar) toolbar.setPage(currentPage);

    // Update progress bar
    if (progressBar) progressBar.update(currentPage, totalPages);

    // Show loading state
    pageContainer.innerHTML = '<div class="viewer-loading">Loading page ' + currentPage + '...</div>';

    // Load and display the page image
    var img = getImage(currentPage);
    img.onload = function() {
      if (currentPage !== pageNum) return; // Page changed while loading
      pageContainer.innerHTML = '';
      pageContainer.appendChild(img);
    };
    img.onerror = function() {
      if (currentPage !== pageNum) return;
      pageContainer.innerHTML = '<div class="viewer-loading">Error loading page</div>';
    };

    // If already loaded, trigger display
    if (img.complete && img.naturalWidth) {
      pageContainer.innerHTML = '';
      pageContainer.appendChild(img);
    }

    // Preload adjacent pages
    preloadAdjacent(pageNum);

    // Save progress (debounced)
    scheduleSave();
  }

  function getImage(pageNum) {
    if (preloadedImages[pageNum]) {
      return preloadedImages[pageNum];
    }

    var img = new Image();
    img.src = API.getPageUrl(doc.id, pageNum);
    preloadedImages[pageNum] = img;
    return img;
  }

  function preloadAdjacent(pageNum) {
    // Keep only 3 pages in memory: prev, current, next
    var keep = {};
    for (var i = pageNum - 1; i <= pageNum + 1; i++) {
      if (i >= 1 && i <= totalPages) {
        keep[i] = true;
        getImage(i); // Trigger preload
      }
    }

    // Evict pages outside the window
    Object.keys(preloadedImages).forEach(function(key) {
      var num = parseInt(key, 10);
      if (!keep[num]) {
        delete preloadedImages[num];
      }
    });
  }

  function nextPage() {
    if (currentPage < totalPages) {
      showPage(currentPage + 1);
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      showPage(currentPage - 1);
    }
  }

  function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
      showPage(page);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      if (doc) {
        API.saveProgress(doc.id, currentPage).catch(function(err) {
          console.error('Failed to save progress:', err);
        });
      }
    }, 2000);
  }

  function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'ArrowRight' || e.keyCode === 39) {
      nextPage();
    } else if (e.key === 'ArrowLeft' || e.keyCode === 37) {
      prevPage();
    } else if (e.key === 'Escape' || e.keyCode === 27) {
      cleanup();
      window.history.back();
    }
  }

  function cleanup() {
    document.removeEventListener('keydown', handleKeyboard);
    clearTimeout(saveTimer);

    // Save progress immediately on exit
    if (doc) {
      API.saveProgress(doc.id, currentPage).catch(function() {});
    }

    doc = null;
    preloadedImages = {};
    toolbar = null;
    progressBar = null;
    pageContainer = null;
  }

  return { render: render, cleanup: cleanup };
})();
