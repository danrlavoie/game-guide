var BookmarkPanel = (function () {
  function create(options) {
    var el = document.createElement('div');
    el.className = 'bookmark-panel';
    el.style.display = 'none';

    var header = document.createElement('div');
    header.className = 'bookmark-panel-header';

    var title = document.createElement('span');
    title.textContent = 'Bookmarks';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'bookmark-panel-close';
    closeBtn.innerHTML = '<i class="fa fa-times"></i>';
    closeBtn.addEventListener('click', function () {
      hide();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    el.appendChild(header);

    var list = document.createElement('div');
    list.className = 'bookmark-panel-list';
    el.appendChild(list);

    var currentBookmarks = [];
    var focusBookmarkId = null;

    function hide() {
      el.style.display = 'none';
      focusBookmarkId = null;
    }

    function renderList() {
      list.innerHTML = '';

      if (currentBookmarks.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'bookmark-panel-empty';
        empty.textContent = 'No bookmarks yet';
        list.appendChild(empty);
        return;
      }

      currentBookmarks.forEach(function (bm) {
        var row = document.createElement('div');
        row.className = 'bookmark-panel-item';

        var info = document.createElement('div');
        info.className = 'bookmark-panel-info';
        info.addEventListener('click', function () {
          if (options.onNavigate) options.onNavigate(bm.page_number);
        });

        var page = document.createElement('span');
        page.className = 'bookmark-panel-page';
        page.textContent = 'p.' + bm.page_number;

        var labelSpan = document.createElement('span');
        labelSpan.className = 'bookmark-panel-label';
        labelSpan.textContent = bm.label || '(no label)';
        if (!bm.label) labelSpan.style.fontStyle = 'italic';

        info.appendChild(page);
        info.appendChild(labelSpan);

        var actions = document.createElement('div');
        actions.className = 'bookmark-panel-actions';

        var editBtn = document.createElement('button');
        editBtn.className = 'bookmark-panel-edit-btn';
        editBtn.innerHTML = '<i class="fa fa-pencil"></i>';
        editBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          showEditField(row, bm);
        });

        var delBtn = document.createElement('button');
        delBtn.className = 'bookmark-panel-del-btn';
        delBtn.innerHTML = '<i class="fa fa-trash"></i>';
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (options.onDelete) options.onDelete(bm.id);
        });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        row.appendChild(info);
        row.appendChild(actions);
        list.appendChild(row);

        // Auto-focus the edit field for a newly created bookmark
        if (focusBookmarkId && bm.id === focusBookmarkId) {
          focusBookmarkId = null;
          showEditField(row, bm);
        }
      });
    }

    function showEditField(row, bm) {
      var info = row.querySelector('.bookmark-panel-info');
      var actions = row.querySelector('.bookmark-panel-actions');
      if (!info || !actions) return;

      info.innerHTML = '';
      actions.innerHTML = '';

      var input = document.createElement('input');
      input.className = 'bookmark-panel-input';
      input.type = 'text';
      input.maxLength = 100;
      input.value = bm.label || '';
      input.placeholder = 'Add a label...';
      input.addEventListener('click', function (e) {
        e.stopPropagation();
      });

      var saving = false;
      function saveLabel() {
        if (saving) return;
        saving = true;
        var newLabel = input.value.trim().substring(0, 100);
        if (options.onEditLabel) {
          options.onEditLabel(bm.id, newLabel);
        }
      }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
          input.blur();
        }
        if (e.key === 'Escape' || e.keyCode === 27) {
          // Cancel — re-render without saving
          renderList();
        }
      });

      input.addEventListener('blur', function () {
        saveLabel();
      });

      info.appendChild(input);

      // Focus after DOM append
      setTimeout(function () {
        input.focus();
        input.select();
      }, 0);
    }

    return {
      el: el,
      show: function (bookmarks, newBookmarkId) {
        currentBookmarks = bookmarks || [];
        focusBookmarkId = newBookmarkId || null;
        el.style.display = '';
        renderList();
      },
      hide: hide,
      isVisible: function () {
        return el.style.display !== 'none';
      },
    };
  }

  return { create: create };
})();
