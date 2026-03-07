var BrowsePage = (function () {
  var currentPage = 1;
  var currentFolder = '';
  var searchQuery = '';
  var searchPage = 1;
  var debounceTimer = null;

  function render(container, folderPath, query) {
    currentFolder = folderPath || '';
    currentPage = 1;
    searchQuery = query || '';
    searchPage = 1;

    container.innerHTML =
      '<div class="header">' +
      '<a href="#/" class="header-back"><i class="fa fa-arrow-left"></i> Home</a>' +
      '<h1>Browse</h1>' +
      '<span></span>' +
      '</div>' +
      '<div class="browse-search-bar" style="padding: 12px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--input-border);">' +
      '<input type="search" id="browse-search" placeholder="Search in this folder..." style="padding: 10px 12px; border: 1px solid var(--input-border); border-radius: var(--radius-md); font-size: 16px; background: var(--bg-tertiary); color: var(--text-primary); box-shadow: inset 0 1px 3px rgba(60, 42, 26, 0.08);" value="' +
      escapeHtml(searchQuery) +
      '">' +
      '<a id="search-all-btn" class="btn btn-secondary browse-search-all" href="#/search" style="display: none;">Search All</a>' +
      '</div>' +
      '<div class="page">' +
      '<div id="breadcrumbs"></div>' +
      '<div id="folders-section"></div>' +
      '<div id="docs-section"></div>' +
      '<div id="load-more-section"></div>' +
      '</div>';

    renderBreadcrumbs();

    var searchInput = document.getElementById('browse-search');
    var searchAllBtn = document.getElementById('search-all-btn');

    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var q = searchInput.value.trim();
        if (q.length >= 2) {
          searchQuery = q;
          searchPage = 1;
          searchAllBtn.href = '#/search?q=' + encodeURIComponent(q);
          searchAllBtn.style.display = '';
          performBrowseSearch();
          history.replaceState(
            null,
            '',
            '#/browse/' +
              encodeURI(currentFolder) +
              '?q=' +
              encodeURIComponent(q)
          );
        } else {
          searchQuery = '';
          searchAllBtn.style.display = 'none';
          currentPage = 1;
          loadFolder();
          history.replaceState(
            null,
            '',
            '#/browse/' + encodeURI(currentFolder)
          );
        }
      }, 500);
    });

    // Show Search All button if initial query present
    if (searchQuery && searchQuery.length >= 2) {
      searchAllBtn.href = '#/search?q=' + encodeURIComponent(searchQuery);
      searchAllBtn.style.display = '';
      performBrowseSearch();
    } else {
      loadFolder();
    }
  }

  function renderBreadcrumbs() {
    var el = document.getElementById('breadcrumbs');
    if (!el) return;

    var crumbs = '<div class="breadcrumbs">';
    crumbs += '<a href="#/browse/">Library</a>';

    if (currentFolder) {
      var parts = currentFolder.split('/');
      var accumulated = '';
      parts.forEach(function (part, i) {
        accumulated += (i > 0 ? '/' : '') + part;
        crumbs += '<span>/</span>';
        if (i === parts.length - 1) {
          crumbs += '<strong>' + escapeHtml(part) + '</strong>';
        } else {
          crumbs +=
            '<a href="#/browse/' +
            encodeURI(accumulated) +
            '">' +
            escapeHtml(part) +
            '</a>';
        }
      });
    }

    crumbs += '</div>';
    el.innerHTML = crumbs;
  }

  function loadFolder() {
    var docsSection = document.getElementById('docs-section');
    if (!docsSection) return;

    if (currentPage === 1) {
      docsSection.innerHTML = '<div class="loading">Loading...</div>';
    }

    API.getDocuments({ folder: currentFolder, page: currentPage, limit: 50 })
      .then(function (data) {
        // Render folders (only on first page)
        if (currentPage === 1) {
          var foldersEl = document.getElementById('folders-section');
          if (foldersEl && data.folders && data.folders.length > 0) {
            var html = '<div class="folder-list">';
            data.folders.forEach(function (folder) {
              html +=
                '<div class="folder-item" onclick="window.location.hash=\'#/browse/' +
                encodeURI(folder.path) +
                '\'">' +
                '<span class="folder-icon"><i class="fa fa-folder"></i></span>' +
                '<span class="folder-name">' +
                escapeHtml(folder.name) +
                '</span>' +
                '</div>';
            });
            html += '</div>';
            foldersEl.innerHTML = html;
          }

          docsSection.innerHTML = '';
        }

        // Render documents
        if (data.documents.length === 0 && currentPage === 1) {
          foldersEl = document.getElementById('folders-section');
          var hasFolders = foldersEl && foldersEl.innerHTML.trim() !== '';
          if (!hasFolders) {
            docsSection.innerHTML =
              '<div class="empty-state"><p>No documents in this folder.</p></div>';
          }
          return;
        }

        var grid = docsSection.querySelector('.doc-grid');
        if (!grid) {
          grid = document.createElement('div');
          grid.className = 'doc-grid';
          docsSection.appendChild(grid);
        }

        data.documents.forEach(function (doc) {
          grid.appendChild(DocumentCard.create(doc));
        });

        // Load more button
        var loadMoreSection = document.getElementById('load-more-section');
        if (loadMoreSection) {
          var loaded = currentPage * 50;
          if (loaded < data.total) {
            loadMoreSection.innerHTML =
              '<div class="load-more">' +
              '<button class="btn btn-secondary" id="load-more-btn">Load More (' +
              loaded +
              ' / ' +
              data.total +
              ')</button></div>';
            document
              .getElementById('load-more-btn')
              .addEventListener('click', function () {
                currentPage++;
                loadFolder();
              });
          } else {
            loadMoreSection.innerHTML = '';
          }
        }
      })
      .catch(function (_err) {
        docsSection.innerHTML =
          '<div class="empty-state"><p>Error loading documents.</p></div>';
      });
  }

  function performBrowseSearch() {
    var docsSection = document.getElementById('docs-section');
    if (!docsSection) return;

    if (searchPage === 1) {
      docsSection.innerHTML = '<div class="loading">Searching...</div>';
    }

    API.search(searchQuery, searchPage, currentFolder)
      .then(function (data) {
        // Render folders on first page
        if (searchPage === 1) {
          var foldersEl = document.getElementById('folders-section');
          if (foldersEl && data.folders && data.folders.length > 0) {
            var html = '<div class="folder-list">';
            data.folders.forEach(function (folder) {
              html +=
                '<div class="folder-item" onclick="window.location.hash=\'#/browse/' +
                encodeURI(folder.path) +
                '\'">' +
                '<span class="folder-icon"><i class="fa fa-folder"></i></span>' +
                '<span class="folder-name">' +
                escapeHtml(folder.name) +
                '</span>' +
                '</div>';
            });
            html += '</div>';
            foldersEl.innerHTML = html;
          } else if (foldersEl) {
            foldersEl.innerHTML = '';
          }
        }

        if (data.documents.length === 0 && searchPage === 1) {
          docsSection.innerHTML =
            '<div class="empty-state"><p>No results for "' +
            escapeHtml(searchQuery) +
            '" in this folder.</p></div>';
          document.getElementById('load-more-section').innerHTML = '';
          return;
        }

        if (searchPage === 1) {
          docsSection.innerHTML =
            '<h2 class="section-title">' +
            data.total +
            ' result' +
            (data.total !== 1 ? 's' : '') +
            '</h2>';
        }

        var grid = docsSection.querySelector('.doc-grid');
        if (!grid) {
          grid = document.createElement('div');
          grid.className = 'doc-grid';
          docsSection.appendChild(grid);
        }

        data.documents.forEach(function (doc) {
          grid.appendChild(DocumentCard.create(doc));
        });

        // Load more button
        var loadMoreSection = document.getElementById('load-more-section');
        if (loadMoreSection) {
          var loaded = searchPage * data.limit;
          if (loaded < data.total) {
            loadMoreSection.innerHTML =
              '<div class="load-more">' +
              '<button class="btn btn-secondary" id="load-more-btn">Load More (' +
              loaded +
              ' / ' +
              data.total +
              ')</button></div>';
            document
              .getElementById('load-more-btn')
              .addEventListener('click', function () {
                searchPage++;
                performBrowseSearch();
              });
          } else {
            loadMoreSection.innerHTML = '';
          }
        }
      })
      .catch(function () {
        docsSection.innerHTML =
          '<div class="empty-state"><p>Search error.</p></div>';
      });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { render: render };
})();
