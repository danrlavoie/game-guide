var API = (function () {
  function request(method, url, body) {
    var options = {
      method: method,
      headers: {},
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    return fetch(url, options).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (data) {
          throw new Error(data.error || 'Request failed');
        });
      }
      return res.json();
    });
  }

  return {
    getDocuments: function (params) {
      var query = [];
      if (params.folder !== undefined)
        query.push('folder=' + encodeURIComponent(params.folder));
      if (params.recent) query.push('recent=true');
      if (params.page) query.push('page=' + params.page);
      if (params.limit) query.push('limit=' + params.limit);
      return request('GET', '/api/documents?' + query.join('&'));
    },

    getDocument: function (id) {
      return request('GET', '/api/documents/' + id);
    },

    getPageUrl: function (docId, pageNum) {
      return '/api/documents/' + docId + '/pages/' + pageNum;
    },

    getThumbnailUrl: function (docId) {
      return '/api/documents/' + docId + '/thumbnail';
    },

    getDownloadUrl: function (docId) {
      return '/api/documents/' + docId + '/download';
    },

    getProgress: function (docId) {
      return request('GET', '/api/documents/' + docId + '/progress');
    },

    saveProgress: function (docId, currentPage) {
      return request('PUT', '/api/documents/' + docId + '/progress', {
        current_page: currentPage,
      });
    },

    search: function (query) {
      return request('GET', '/api/search?q=' + encodeURIComponent(query));
    },

    triggerScan: function () {
      return request('POST', '/api/scan');
    },

    getTextContent: function (docId) {
      return fetch('/api/documents/' + docId + '/content').then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error(data.error || 'Request failed');
          });
        }
        return res.text();
      });
    },

    getDocumentSettings: function (docId) {
      return request('GET', '/api/documents/' + docId + '/settings');
    },

    saveDocumentSetting: function (docId, key, value) {
      return request('PUT', '/api/documents/' + docId + '/settings', {
        key: key,
        value: value,
      });
    },

    getBookmarks: function (docId) {
      return request('GET', '/api/documents/' + docId + '/bookmarks');
    },

    addBookmark: function (docId, pageNumber, label) {
      return request('POST', '/api/documents/' + docId + '/bookmarks', {
        page_number: pageNumber,
        label: label || '',
      });
    },

    updateBookmark: function (docId, bookmarkId, label) {
      return request(
        'PUT',
        '/api/documents/' + docId + '/bookmarks/' + bookmarkId,
        { label: label }
      );
    },

    deleteBookmark: function (docId, bookmarkId) {
      return request(
        'DELETE',
        '/api/documents/' + docId + '/bookmarks/' + bookmarkId
      );
    },

    getFavorites: function () {
      return request('GET', '/api/favorites');
    },

    addFavorite: function (docId) {
      return request('POST', '/api/documents/' + docId + '/favorite');
    },

    removeFavorite: function (docId) {
      return request('DELETE', '/api/documents/' + docId + '/favorite');
    },

    getSettings: function () {
      return request('GET', '/api/settings');
    },

    saveSetting: function (key, value) {
      return request('PUT', '/api/settings', { key: key, value: value });
    },

    getHealth: function () {
      return request('GET', '/api/health');
    },
  };
})();
