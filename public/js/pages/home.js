var HomePage = (function () {
  function render(container) {
    container.innerHTML =
      '<div class="header">' +
      '<h1>The Study</h1>' +
      '<div class="header-actions">' +
      '<button class="scan-btn" id="scan-btn"><i class="fa fa-refresh"></i> Scan</button>' +
      '<a href="#/settings" class="scan-btn" style="margin-left: 8px;"><i class="fa fa-cog"></i> Settings</a>' +
      '</div>' +
      '</div>' +
      '<div class="search-bar">' +
      '<input type="search" id="home-search" placeholder="Search documents...">' +
      '</div>' +
      '<div class="page">' +
      '<div id="recent-section"></div>' +
      '<div id="favorites-section"></div>' +
      '<div style="margin-top: 24px; text-align: center;">' +
      '<a href="#/browse/" class="btn btn-block">Browse Library</a>' +
      '</div>' +
      '</div>';

    // Search input
    var searchInput = document.getElementById('home-search');
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        var q = searchInput.value.trim();
        if (q) {
          window.location.hash = '#/search?q=' + encodeURIComponent(q);
        }
      }
    });

    // Scan button
    document.getElementById('scan-btn').addEventListener('click', function () {
      var btn = document.getElementById('scan-btn');
      btn.innerHTML = '<i class="fa fa-refresh"></i> Scanning...';
      btn.disabled = true;
      API.triggerScan()
        .then(function (_result) {
          btn.innerHTML = '<i class="fa fa-refresh"></i> Done!';
          setTimeout(function () {
            btn.innerHTML = '<i class="fa fa-refresh"></i> Scan';
            btn.disabled = false;
          }, 2000);
          loadRecent();
          loadFavorites();
        })
        .catch(function (_err) {
          btn.innerHTML = '<i class="fa fa-refresh"></i> Error';
          setTimeout(function () {
            btn.innerHTML = '<i class="fa fa-refresh"></i> Scan';
            btn.disabled = false;
          }, 2000);
        });
    });

    loadRecent();
    loadFavorites();
  }

  function loadRecent() {
    var section = document.getElementById('recent-section');
    if (!section) return;

    API.getDocuments({ recent: true, limit: 5 })
      .then(function (data) {
        if (!data.documents || data.documents.length === 0) {
          section.innerHTML =
            '<h2 class="section-title">Recently Viewed</h2>' +
            '<div class="empty-state"><p>No recently viewed documents.</p></div>';
          return;
        }

        section.innerHTML = '<h2 class="section-title">Recently Viewed</h2>';

        var scrollContainer = document.createElement('div');
        scrollContainer.className = 'recent-docs';

        data.documents.forEach(function (doc) {
          scrollContainer.appendChild(DocumentCard.create(doc));
        });

        section.appendChild(scrollContainer);
      })
      .catch(function (_err) {
        section.innerHTML =
          '<div class="empty-state"><p>Could not load recent documents.</p></div>';
      });
  }

  function loadFavorites() {
    var section = document.getElementById('favorites-section');
    if (!section) return;

    API.getFavorites()
      .then(function (data) {
        if (!data.documents || data.documents.length === 0) {
          section.innerHTML = '';
          return;
        }

        section.innerHTML = '<h2 class="section-title">Favorites</h2>';

        var scrollContainer = document.createElement('div');
        scrollContainer.className = 'recent-docs';

        data.documents.forEach(function (doc) {
          scrollContainer.appendChild(DocumentCard.create(doc));
        });

        section.appendChild(scrollContainer);
      })
      .catch(function () {
        section.innerHTML = '';
      });
  }

  return { render: render };
})();
