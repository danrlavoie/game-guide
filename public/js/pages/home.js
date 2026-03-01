var HomePage = (function() {

  function render(container) {
    container.innerHTML =
      '<div class="header">' +
        '<h1>Game Guide</h1>' +
        '<div class="header-actions">' +
          '<button class="scan-btn" id="scan-btn">Scan</button>' +
          '<a href="#/settings" class="scan-btn" style="margin-left: 8px;">Settings</a>' +
        '</div>' +
      '</div>' +
      '<div class="search-bar">' +
        '<input type="search" id="home-search" placeholder="Search documents...">' +
      '</div>' +
      '<div class="page">' +
        '<div id="recent-section"></div>' +
        '<div style="margin-top: 24px; text-align: center;">' +
          '<a href="#/browse/" class="btn btn-block">Browse Library</a>' +
        '</div>' +
      '</div>';

    // Search input
    var searchInput = document.getElementById('home-search');
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        var q = searchInput.value.trim();
        if (q) {
          window.location.hash = '#/search?q=' + encodeURIComponent(q);
        }
      }
    });

    // Scan button
    document.getElementById('scan-btn').addEventListener('click', function() {
      var btn = document.getElementById('scan-btn');
      btn.textContent = 'Scanning...';
      btn.disabled = true;
      API.triggerScan().then(function(result) {
        btn.textContent = 'Done!';
        setTimeout(function() { btn.textContent = 'Scan'; btn.disabled = false; }, 2000);
        loadRecent();
      }).catch(function(err) {
        btn.textContent = 'Error';
        setTimeout(function() { btn.textContent = 'Scan'; btn.disabled = false; }, 2000);
      });
    });

    loadRecent();
  }

  function loadRecent() {
    var section = document.getElementById('recent-section');
    if (!section) return;

    API.getDocuments({ recent: true, limit: 5 }).then(function(data) {
      if (!data.documents || data.documents.length === 0) {
        section.innerHTML =
          '<h2 class="section-title">Recently Viewed</h2>' +
          '<div class="empty-state"><p>No recently viewed documents.</p></div>';
        return;
      }

      section.innerHTML = '<h2 class="section-title">Recently Viewed</h2>';

      var scrollContainer = document.createElement('div');
      scrollContainer.className = 'recent-docs';

      data.documents.forEach(function(doc) {
        scrollContainer.appendChild(DocumentCard.create(doc));
      });

      section.appendChild(scrollContainer);
    }).catch(function(err) {
      section.innerHTML = '<div class="empty-state"><p>Could not load recent documents.</p></div>';
    });
  }

  return { render: render };
})();
