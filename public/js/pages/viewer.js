var ViewerPage = (function () {
  var doc = null;
  var currentPage = 1;
  var totalPages = 0;
  var toolbar = null;
  var progressBar = null;
  var pageContainer = null;
  var saveTimer = null;
  var preloadedImages = {};
  var spreadMode = 'single';
  var page1Side = 'left';
  var isFavorited = false;
  var bookmarks = [];
  var bookmarkPanel = null;

  function render(container, docId) {
    container.innerHTML =
      '<div class="viewer"><div class="viewer-loading">Loading...</div></div>';

    // Load document, device settings, document settings, and bookmarks in parallel
    Promise.all([
      API.getDocument(docId),
      API.getSettings(),
      API.getDocumentSettings(docId),
      API.getBookmarks(docId),
    ])
      .then(function (results) {
        doc = results[0];
        var deviceSettings = results[1];
        var docSettings = results[2];
        bookmarks = results[3].bookmarks || [];

        totalPages = doc.page_count;
        currentPage = doc.current_page || 1;
        isFavorited = !!doc.is_favorite;

        // Resolve spread mode: default -> device setting -> document override
        spreadMode = 'single';
        if (deviceSettings.spread_mode === 'spread') {
          spreadMode = 'spread';
        }
        if (
          docSettings.spread_mode === 'single' ||
          docSettings.spread_mode === 'spread'
        ) {
          spreadMode = docSettings.spread_mode;
        }

        // Resolve page1Side: default -> document setting
        page1Side = 'left';
        if (
          docSettings.page1_side === 'left' ||
          docSettings.page1_side === 'right'
        ) {
          page1Side = docSettings.page1_side;
        }

        buildViewer(container);
        showPage(currentPage);
      })
      .catch(function (_err) {
        container.innerHTML =
          '<div class="page"><div class="empty-state">' +
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
      spreadMode: spreadMode,
      page1Side: page1Side,
      isFavorited: isFavorited,
      onBack: function () {
        cleanup();
        window.history.back();
      },
      onPageChange: function (page) {
        goToPage(page);
      },
      onSpreadToggle: function () {
        spreadMode = spreadMode === 'single' ? 'spread' : 'single';
        toolbar.setSpreadMode(spreadMode);
        updateContainerClass();
        // Save as document-level override
        API.saveDocumentSetting(doc.id, 'spread_mode', spreadMode).catch(
          function () {}
        );
        // Re-display current page with new mode
        showPage(currentPage);
      },
      onAlignToggle: function () {
        page1Side = page1Side === 'left' ? 'right' : 'left';
        toolbar.setPage1Side(page1Side);
        // Save as document-level setting
        API.saveDocumentSetting(doc.id, 'page1_side', page1Side).catch(
          function () {}
        );
        // Re-display current page with new alignment
        showPage(currentPage);
      },
      onFavoriteToggle: function () {
        toggleFavorite();
      },
      onBookmarkToggle: function () {
        toggleBookmark();
      },
      onBookmarksListToggle: function () {
        if (bookmarkPanel.isVisible()) {
          bookmarkPanel.hide();
        } else {
          bookmarkPanel.show(bookmarks);
        }
      },
    });
    viewer.appendChild(toolbar.el);

    // Bookmark panel
    bookmarkPanel = BookmarkPanel.create({
      onNavigate: function (pageNumber) {
        bookmarkPanel.hide();
        goToPage(pageNumber);
      },
      onDelete: function (bookmarkId) {
        API.deleteBookmark(doc.id, bookmarkId)
          .then(function () {
            bookmarks = bookmarks.filter(function (bm) {
              return bm.id !== bookmarkId;
            });
            bookmarkPanel.show(bookmarks);
            updateBookmarkState();
          })
          .catch(function () {});
      },
      onEditLabel: function (bookmarkId, newLabel) {
        API.updateBookmark(doc.id, bookmarkId, newLabel)
          .then(function (data) {
            bookmarks = bookmarks.map(function (bm) {
              if (bm.id === bookmarkId) {
                return data.bookmark;
              }
              return bm;
            });
            bookmarkPanel.show(bookmarks);
          })
          .catch(function () {});
      },
    });
    viewer.appendChild(bookmarkPanel.el);

    // Page container
    pageContainer = document.createElement('div');
    pageContainer.className = 'viewer-page-container';
    updateContainerClass();
    viewer.appendChild(pageContainer);

    // Touch handling
    TouchHandler.create(pageContainer, {
      onTapLeft: function () {
        prevPage();
      },
      onTapRight: function () {
        nextPage();
      },
      onTapCenter: function () {
        toolbar.toggle();
      },
      onSwipeLeft: function () {
        nextPage();
      },
      onSwipeRight: function () {
        prevPage();
      },
    });

    // Progress bar
    progressBar = ProgressBar.create();
    viewer.appendChild(progressBar.el);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);

    container.innerHTML = '';
    container.appendChild(viewer);
  }

  function updateContainerClass() {
    if (!pageContainer) return;
    if (spreadMode === 'spread') {
      pageContainer.classList.add('spread-mode');
    } else {
      pageContainer.classList.remove('spread-mode');
    }
  }

  function getSpreadPages(pageNum) {
    if (spreadMode === 'single') return [pageNum];

    var leftPage, rightPage;
    if (page1Side === 'left') {
      // Pages pair as: [1,2], [3,4], [5,6]...
      leftPage = pageNum % 2 === 1 ? pageNum : pageNum - 1;
      rightPage = leftPage + 1;
    } else {
      // Page 1 on right: [null,1], [2,3], [4,5]...
      if (pageNum === 1) return [null, 1];
      leftPage = pageNum % 2 === 0 ? pageNum : pageNum - 1;
      rightPage = leftPage + 1;
    }

    if (rightPage > totalPages) return [leftPage, null];
    return [leftPage, rightPage];
  }

  function showPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages || !pageContainer) return;

    var pages = getSpreadPages(pageNum);

    // In spread mode, normalize currentPage to the left-most real page of the pair
    if (spreadMode === 'spread') {
      var firstReal = pages[0] || pages[1];
      currentPage = firstReal;
    } else {
      currentPage = pageNum;
    }

    // Update toolbar with the primary displayed page
    var displayPage = pages[0] || pages[1];
    if (toolbar) toolbar.setPage(displayPage);
    updateBookmarkState();

    // Update progress bar
    if (progressBar) progressBar.update(displayPage, totalPages);

    // Show loading state
    pageContainer.innerHTML = '<div class="viewer-loading">Loading...</div>';

    if (spreadMode === 'single') {
      // Single page mode - unchanged behavior
      var img = getImage(currentPage);
      img.className = 'viewer-page-img';
      var loadPage = currentPage;
      img.onload = function () {
        if (currentPage !== loadPage) return;
        pageContainer.innerHTML = '';
        pageContainer.appendChild(img);
      };
      img.onerror = function () {
        if (currentPage !== loadPage) return;
        pageContainer.innerHTML =
          '<div class="viewer-loading">Error loading page</div>';
      };
      if (img.complete && img.naturalWidth) {
        pageContainer.innerHTML = '';
        pageContainer.appendChild(img);
      }
    } else {
      // Spread mode - two images side by side
      var loadTarget = currentPage;
      var leftPage = pages[0];
      var rightPage = pages[1];
      var loaded = { left: !leftPage, right: !rightPage };

      var wrapper = document.createElement('div');
      wrapper.className = 'spread-wrapper';

      var leftSlot = document.createElement('div');
      leftSlot.className = 'spread-slot spread-slot-left';
      var rightSlot = document.createElement('div');
      rightSlot.className = 'spread-slot spread-slot-right';

      function tryFinish() {
        if (loaded.left && loaded.right && currentPage === loadTarget) {
          pageContainer.innerHTML = '';
          pageContainer.appendChild(wrapper);
        }
      }

      if (leftPage) {
        var leftImg = getImage(leftPage);
        leftImg.className = 'viewer-page-img';
        leftImg.onload = function () {
          if (currentPage !== loadTarget) return;
          leftSlot.innerHTML = '';
          leftSlot.appendChild(leftImg);
          loaded.left = true;
          tryFinish();
        };
        leftImg.onerror = function () {
          loaded.left = true;
          tryFinish();
        };
        if (leftImg.complete && leftImg.naturalWidth) {
          leftSlot.appendChild(leftImg);
          loaded.left = true;
        }
      }

      if (rightPage) {
        var rightImg = getImage(rightPage);
        rightImg.className = 'viewer-page-img';
        rightImg.onload = function () {
          if (currentPage !== loadTarget) return;
          rightSlot.innerHTML = '';
          rightSlot.appendChild(rightImg);
          loaded.right = true;
          tryFinish();
        };
        rightImg.onerror = function () {
          loaded.right = true;
          tryFinish();
        };
        if (rightImg.complete && rightImg.naturalWidth) {
          rightSlot.appendChild(rightImg);
          loaded.right = true;
        }
      }

      wrapper.appendChild(leftSlot);
      wrapper.appendChild(rightSlot);

      // Show immediately if both already loaded
      if (loaded.left && loaded.right) {
        pageContainer.innerHTML = '';
        pageContainer.appendChild(wrapper);
      }
    }

    // Preload adjacent pages
    preloadAdjacent(currentPage);

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
    var keep = {};

    if (spreadMode === 'single') {
      // Keep 3 pages: prev, current, next
      for (var i = pageNum - 1; i <= pageNum + 1; i++) {
        if (i >= 1 && i <= totalPages) {
          keep[i] = true;
          getImage(i);
        }
      }
    } else {
      // Keep current pair + prev pair + next pair (up to 6 pages)
      var currentPair = getSpreadPages(pageNum);
      var step = 2;
      var prevStart = (currentPair[0] || currentPair[1]) - step;
      var nextStart = (currentPair[1] || currentPair[0]) + 1;

      // Current pair
      currentPair.forEach(function (p) {
        if (p && p >= 1 && p <= totalPages) {
          keep[p] = true;
          getImage(p);
        }
      });

      // Previous pair
      if (prevStart >= 1) {
        var prevPair = getSpreadPages(prevStart);
        prevPair.forEach(function (p) {
          if (p && p >= 1 && p <= totalPages) {
            keep[p] = true;
            getImage(p);
          }
        });
      }

      // Next pair
      if (nextStart <= totalPages) {
        var nextPair = getSpreadPages(nextStart);
        nextPair.forEach(function (p) {
          if (p && p >= 1 && p <= totalPages) {
            keep[p] = true;
            getImage(p);
          }
        });
      }
    }

    // Evict pages outside the window
    Object.keys(preloadedImages).forEach(function (key) {
      var num = parseInt(key, 10);
      if (!keep[num]) {
        delete preloadedImages[num];
      }
    });
  }

  function nextPage() {
    var step = spreadMode === 'spread' ? 2 : 1;
    var next = currentPage + step;
    if (next <= totalPages) {
      showPage(next);
    }
  }

  function prevPage() {
    var step = spreadMode === 'spread' ? 2 : 1;
    var prev = currentPage - step;
    if (prev >= 1) {
      showPage(prev);
    }
  }

  function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
      showPage(page);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (doc) {
        API.saveProgress(doc.id, currentPage).catch(function () {});
      }
    }, 2000);
  }

  function isPageBookmarked(pageNum) {
    for (var i = 0; i < bookmarks.length; i++) {
      if (bookmarks[i].page_number === pageNum) return bookmarks[i];
    }
    return null;
  }

  function updateBookmarkState() {
    if (!toolbar) return;
    toolbar.setBookmarked(!!isPageBookmarked(currentPage));
  }

  function toggleBookmark() {
    var existing = isPageBookmarked(currentPage);
    if (existing) {
      API.deleteBookmark(doc.id, existing.id)
        .then(function () {
          bookmarks = bookmarks.filter(function (bm) {
            return bm.id !== existing.id;
          });
          updateBookmarkState();
          if (bookmarkPanel.isVisible()) {
            bookmarkPanel.show(bookmarks);
          }
        })
        .catch(function () {});
    } else {
      API.addBookmark(doc.id, currentPage, '')
        .then(function (data) {
          bookmarks.push(data.bookmark);
          bookmarks.sort(function (a, b) {
            return a.page_number - b.page_number;
          });
          updateBookmarkState();
          // Open panel with new bookmark focused for label editing
          bookmarkPanel.show(bookmarks, data.bookmark.id);
        })
        .catch(function () {});
    }
  }

  function toggleFavorite() {
    var promise = isFavorited
      ? API.removeFavorite(doc.id)
      : API.addFavorite(doc.id);
    promise
      .then(function () {
        isFavorited = !isFavorited;
        toolbar.setFavorited(isFavorited);
      })
      .catch(function () {});
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
      API.saveProgress(doc.id, currentPage).catch(function () {});
    }

    doc = null;
    preloadedImages = {};
    toolbar = null;
    progressBar = null;
    pageContainer = null;
    spreadMode = 'single';
    page1Side = 'left';
    isFavorited = false;
    bookmarks = [];
    bookmarkPanel = null;
  }

  return { render: render, cleanup: cleanup };
})();
