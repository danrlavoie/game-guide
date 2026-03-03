var SearchPage = (function () {
  var debounceTimer = null;

  function render(container, query) {
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
      '</div>';

    var input = document.getElementById('search-input');
    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        var q = input.value.trim();
        if (q.length >= 2) {
          performSearch(q);
          // Update hash without triggering re-render
          history.replaceState(null, '', '#/search?q=' + encodeURIComponent(q));
        } else {
          document.getElementById('search-results').innerHTML = '';
        }
      }, 300);
    });

    // Focus input
    input.focus();

    // Run initial search if query provided
    if (query && query.length >= 2) {
      performSearch(query);
    }
  }

  function performSearch(query) {
    var resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;

    resultsEl.innerHTML = '<div class="loading">Searching...</div>';

    API.search(query)
      .then(function (data) {
        if (data.documents.length === 0) {
          resultsEl.innerHTML =
            '<div class="empty-state"><p>No results for "' +
            escapeHtml(query) +
            '"</p></div>';
          return;
        }

        resultsEl.innerHTML =
          '<h2 class="section-title">' +
          data.documents.length +
          ' result' +
          (data.documents.length !== 1 ? 's' : '') +
          '</h2>';

        var grid = document.createElement('div');
        grid.className = 'doc-grid';

        data.documents.forEach(function (doc) {
          grid.appendChild(DocumentCard.create(doc));
        });

        resultsEl.appendChild(grid);
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
