var SettingsPage = (function () {
  function render(container) {
    container.innerHTML =
      '<div class="header">' +
      '<a href="#/" class="header-back">Back</a>' +
      '<h1>Settings</h1>' +
      '<div style="width: 48px;"></div>' +
      '</div>' +
      '<div class="page">' +
      '<div class="settings-list" id="settings-list">' +
      '<div class="loading">Loading settings...</div>' +
      '</div>' +
      '</div>';

    loadSettings();
  }

  function loadSettings() {
    var list = document.getElementById('settings-list');
    if (!list) return;

    API.getSettings()
      .then(function (settings) {
        var isDark = settings.theme === 'dark';
        var isSpread = settings.spread_mode === 'spread';

        list.innerHTML =
          '<div class="settings-row">' +
          '<div>' +
          '<div class="settings-label">Dark Mode</div>' +
          '<div class="settings-description">Switch to a darker color scheme</div>' +
          '</div>' +
          '<label class="toggle-switch">' +
          '<input type="checkbox" id="theme-toggle"' +
          (isDark ? ' checked' : '') +
          '>' +
          '<span class="toggle-slider"></span>' +
          '</label>' +
          '</div>' +
          '<div class="settings-row">' +
          '<div>' +
          '<div class="settings-label">Two-Page Spread</div>' +
          '<div class="settings-description">Default to side-by-side page display</div>' +
          '</div>' +
          '<label class="toggle-switch">' +
          '<input type="checkbox" id="spread-toggle"' +
          (isSpread ? ' checked' : '') +
          '>' +
          '<span class="toggle-slider"></span>' +
          '</label>' +
          '</div>';

        var themeToggle = document.getElementById('theme-toggle');
        themeToggle.addEventListener('change', function () {
          var value = themeToggle.checked ? 'dark' : 'light';
          document.documentElement.setAttribute(
            'data-theme',
            value === 'dark' ? 'dark' : ''
          );
          if (value === 'light') {
            document.documentElement.removeAttribute('data-theme');
          }
          API.saveSetting('theme', value);
        });

        var spreadToggle = document.getElementById('spread-toggle');
        spreadToggle.addEventListener('change', function () {
          var value = spreadToggle.checked ? 'spread' : 'single';
          API.saveSetting('spread_mode', value);
        });

        // Text Files section
        var txtFonts = [
          {
            label: 'Menlo',
            value: 'Menlo, Monaco, "Courier New", Courier, monospace',
          },
          { label: 'Courier New', value: '"Courier New", Courier, monospace' },
          {
            label: 'Monaco',
            value: 'Monaco, "Courier New", Courier, monospace',
          },
        ];
        var txtFontSizes = [11, 12, 13, 14, 16, 18, 20];
        var txtMargins = [0, 8, 16, 24, 32, 48, 64];

        var currentFont =
          settings.txt_font ||
          'Menlo, Monaco, "Courier New", Courier, monospace';
        var currentSize = settings.txt_font_size || '14';
        var currentMargin = settings.txt_margin || '16';

        var sectionLabel = document.createElement('div');
        sectionLabel.className = 'settings-section-label';
        sectionLabel.textContent = 'Text Files';
        list.appendChild(sectionLabel);

        // Font select
        var fontOptions = txtFonts
          .map(function (f) {
            var selected = f.value === currentFont ? ' selected' : '';
            return (
              '<option value="' +
              f.value.replace(/"/g, '&quot;') +
              '"' +
              selected +
              '>' +
              f.label +
              '</option>'
            );
          })
          .join('');
        list.insertAdjacentHTML(
          'beforeend',
          '<div class="settings-row">' +
            '<div>' +
            '<div class="settings-label">Text Font</div>' +
            '<div class="settings-description">Monospace font for text files</div>' +
            '</div>' +
            '<select class="settings-select" id="txt-font-select">' +
            fontOptions +
            '</select>' +
            '</div>'
        );

        // Font size select
        var sizeOptions = txtFontSizes
          .map(function (s) {
            var selected = String(s) === currentSize ? ' selected' : '';
            return (
              '<option value="' + s + '"' + selected + '>' + s + 'px</option>'
            );
          })
          .join('');
        list.insertAdjacentHTML(
          'beforeend',
          '<div class="settings-row">' +
            '<div>' +
            '<div class="settings-label">Text Font Size</div>' +
            '<div class="settings-description">Font size for text files</div>' +
            '</div>' +
            '<select class="settings-select" id="txt-size-select">' +
            sizeOptions +
            '</select>' +
            '</div>'
        );

        // Margin select
        var marginOptions = txtMargins
          .map(function (m) {
            var selected = String(m) === currentMargin ? ' selected' : '';
            return (
              '<option value="' + m + '"' + selected + '>' + m + 'px</option>'
            );
          })
          .join('');
        list.insertAdjacentHTML(
          'beforeend',
          '<div class="settings-row">' +
            '<div>' +
            '<div class="settings-label">Text Margin</div>' +
            '<div class="settings-description">Horizontal padding for text files</div>' +
            '</div>' +
            '<select class="settings-select" id="txt-margin-select">' +
            marginOptions +
            '</select>' +
            '</div>'
        );

        document
          .getElementById('txt-font-select')
          .addEventListener('change', function () {
            API.saveSetting('txt_font', this.value);
          });
        document
          .getElementById('txt-size-select')
          .addEventListener('change', function () {
            API.saveSetting('txt_font_size', this.value);
          });
        document
          .getElementById('txt-margin-select')
          .addEventListener('change', function () {
            API.saveSetting('txt_margin', this.value);
          });
      })
      .catch(function () {
        list.innerHTML =
          '<div class="empty-state"><p>Could not load settings.</p></div>';
      });
  }

  return { render: render };
})();
