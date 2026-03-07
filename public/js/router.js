var Router = (function () {
  var app = document.getElementById('app');
  var currentCleanup = null;

  function init() {
    window.addEventListener('hashchange', route);
    route();
  }

  function route() {
    var hash = window.location.hash || '#/';

    // Cleanup previous page if needed
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    // Parse route
    if (hash === '#/' || hash === '' || hash === '#') {
      HomePage.render(app);
    } else if (hash.indexOf('#/browse/') === 0 || hash === '#/browse') {
      var browseRemainder = hash.substring('#/browse/'.length);
      var browseQIndex = browseRemainder.indexOf('?');
      var folderPath =
        browseQIndex >= 0
          ? decodeURI(browseRemainder.substring(0, browseQIndex))
          : decodeURI(browseRemainder);
      var browseQueryMatch =
        browseQIndex >= 0
          ? browseRemainder.substring(browseQIndex).match(/[?&]q=([^&]*)/)
          : null;
      var browseQuery = browseQueryMatch
        ? decodeURIComponent(browseQueryMatch[1])
        : '';
      BrowsePage.render(app, folderPath, browseQuery);
    } else if (hash.indexOf('#/read/') === 0) {
      var txtDocId = hash.substring('#/read/'.length);
      currentCleanup = TextViewerPage.cleanup;
      TextViewerPage.render(app, txtDocId);
    } else if (hash.indexOf('#/view/') === 0) {
      var docId = hash.substring('#/view/'.length);
      currentCleanup = ViewerPage.cleanup;
      ViewerPage.render(app, docId);
    } else if (hash === '#/settings') {
      SettingsPage.render(app);
    } else if (hash.indexOf('#/search') === 0) {
      var queryMatch = hash.match(/[?&]q=([^&]*)/);
      var query = queryMatch ? decodeURIComponent(queryMatch[1]) : '';
      SearchPage.render(app, query);
    } else {
      HomePage.render(app);
    }
  }

  return { init: init };
})();
