var SettingsPage = (function() {

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

    API.getSettings().then(function(settings) {
      var isDark = settings.theme === 'dark';
      var isSpread = settings.spread_mode === 'spread';

      list.innerHTML =
        '<div class="settings-row">' +
          '<div>' +
            '<div class="settings-label">Dark Mode</div>' +
            '<div class="settings-description">Switch to a darker color scheme</div>' +
          '</div>' +
          '<label class="toggle-switch">' +
            '<input type="checkbox" id="theme-toggle"' + (isDark ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<div class="settings-row">' +
          '<div>' +
            '<div class="settings-label">Two-Page Spread</div>' +
            '<div class="settings-description">Default to side-by-side page display</div>' +
          '</div>' +
          '<label class="toggle-switch">' +
            '<input type="checkbox" id="spread-toggle"' + (isSpread ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>';

      var themeToggle = document.getElementById('theme-toggle');
      themeToggle.addEventListener('change', function() {
        var value = themeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', value === 'dark' ? 'dark' : '');
        if (value === 'light') {
          document.documentElement.removeAttribute('data-theme');
        }
        API.saveSetting('theme', value);
      });

      var spreadToggle = document.getElementById('spread-toggle');
      spreadToggle.addEventListener('change', function() {
        var value = spreadToggle.checked ? 'spread' : 'single';
        API.saveSetting('spread_mode', value);
      });
    }).catch(function() {
      list.innerHTML = '<div class="empty-state"><p>Could not load settings.</p></div>';
    });
  }

  return { render: render };
})();
