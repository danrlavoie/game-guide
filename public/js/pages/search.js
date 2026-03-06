var SearchPage = (function () {
  var debounceTimer = null;
  var currentPage = 1;
  var currentQuery = '';

  function render(container, query) {
    currentPage = 1;
    currentQuery = '';

    container.innerHTML =
      '<div class="header">' +
      '<a href="#/" class="header-back">Home</a>' +
      '<h1>Search</h1>' +
      '<span></span>' +
      '</div>' +
      '<div class="search-bar">' +
      '<input type="search" id="search-input" placeholder="Search documents..." value="' +
      escapeHtml(query || '') +
      '">' +
      '</div>' +
      '<div class="page">' +
      '<div id="search-results"></div>' +
      '<div id="load-more-section"></div>' +
      '</div>';

    var input = document.getElementById('search-input');
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var q = input.value.trim();
        if (q.length >= 2) {
          currentPage = 1;
          currentQuery = q;
          performSearch(q, 1);
          // Update hash without triggering re-render
          history.replaceState(null, '', '#/search?q=' + encodeURIComponent(q));
        } else {
          currentQuery = '';
          document.getElementById('search-results').innerHTML = '';
          document.getElementById('load-more-section').innerHTML = '';
        }
      }, 300);
    });

    // Focus input
    input.focus();

    // Run initial search if query provided
    if (query && query.length >= 2) {
      currentQuery = query;
      performSearch(query, 1);
    }
  }

  function performSearch(query, page) {
    var resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;

    if (page === 1) {
      resultsEl.innerHTML = '<div class="loading">Searching...</div>';
    }

    API.search(query, page)
      .then(function (data) {
        if (data.documents.length === 0 && page === 1) {
          resultsEl.innerHTML =
            '<div class="empty-state"><p>No results for "' +
            escapeHtml(query) +
            '"</p></div>';
          document.getElementById('load-more-section').innerHTML = '';
          return;
        }

        if (page === 1) {
          resultsEl.innerHTML =
            '<h2 class="section-title">' +
            data.total +
            ' result' +
            (data.total !== 1 ? 's' : '') +
            '</h2>';
        }

        var grid = resultsEl.querySelector('.doc-grid');
        if (!grid) {
          grid = document.createElement('div');
          grid.className = 'doc-grid';
          resultsEl.appendChild(grid);
        }

        data.documents.forEach(function (doc) {
          grid.appendChild(DocumentCard.create(doc));
        });

        // Load more button
        var loadMoreSection = document.getElementById('load-more-section');
        if (loadMoreSection) {
          var loaded = currentPage * data.limit;
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
                performSearch(currentQuery, currentPage);
              });
          } else {
            loadMoreSection.innerHTML = '';
          }
        }
      })
      .catch(function (_err) {
        resultsEl.innerHTML =
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
