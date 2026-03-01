var TextViewerPage = (function() {

  var doc = null;
  var scrollContainer = null;
  var settingsPanel = null;
  var saveTimer = null;
  var settingsPanelVisible = false;

  // Default settings — overridden from device settings on load
  var txtFont = 'Menlo, Monaco, "Courier New", Courier, monospace';
  var txtFontSize = 14;
  var txtMargin = 16;

  var FONTS = [
    { label: 'Menlo', value: 'Menlo, Monaco, "Courier New", Courier, monospace' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'Monaco', value: 'Monaco, "Courier New", Courier, monospace' }
  ];

  var FONT_SIZES = [11, 12, 13, 14, 16, 18, 20];
  var MARGINS = [0, 8, 16, 24, 32, 48, 64];

  function render(container, docId) {
    container.innerHTML = '<div class="viewer"><div class="viewer-loading">Loading...</div></div>';

    var docPromise = API.getDocument(docId);
    var settingsPromise = API.getSettings();

    Promise.all([docPromise, settingsPromise]).then(function(results) {
      doc = results[0];
      var settings = results[1];

      if (doc.file_type !== 'txt') {
        window.location.hash = '#/view/' + docId;
        return;
      }

      // Apply stored per-device settings
      if (settings.txt_font) txtFont = settings.txt_font;
      if (settings.txt_font_size) txtFontSize = parseInt(settings.txt_font_size, 10);
      if (settings.txt_margin) txtMargin = parseInt(settings.txt_margin, 10);

      return API.getTextContent(docId);
    }).then(function(content) {
      if (content !== undefined) {
        buildViewer(container, content);
      }
    }).catch(function() {
      container.innerHTML = '<div class="page"><div class="empty-state">' +
        '<p>Error loading document.</p>' +
        '<a href="#/" class="btn" style="margin-top:16px">Go Home</a>' +
        '</div></div>';
    });
  }

  function buildViewer(container, content) {
    var viewer = document.createElement('div');
    viewer.className = 'viewer txt-viewer';

    buildToolbar(viewer);
    buildSettingsPanel(viewer);
    buildScrollContainer(viewer, content);

    document.addEventListener('keydown', handleKeyboard);

    container.innerHTML = '';
    container.appendChild(viewer);

    applySettings();
    restoreScrollPosition();
  }

  function buildToolbar(viewer) {
    var bar = document.createElement('div');
    bar.className = 'viewer-toolbar txt-toolbar';

    var left = document.createElement('div');
    left.className = 'viewer-toolbar-left';
    var backBtn = document.createElement('button');
    backBtn.className = 'viewer-back-btn';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', function() {
      cleanup();
      window.history.back();
    });
    left.appendChild(backBtn);

    var center = document.createElement('div');
    center.className = 'viewer-toolbar-center';
    var title = document.createElement('span');
    title.className = 'txt-viewer-title';
    title.textContent = doc.file_name;
    center.appendChild(title);

    var right = document.createElement('div');
    right.className = 'viewer-toolbar-right';

    var settingsBtn = document.createElement('button');
    settingsBtn.className = 'viewer-back-btn';
    settingsBtn.textContent = 'Aa';
    settingsBtn.addEventListener('click', function() {
      toggleSettings();
    });
    right.appendChild(settingsBtn);

    var downloadLink = document.createElement('a');
    downloadLink.className = 'viewer-download-btn';
    downloadLink.textContent = 'Download';
    downloadLink.href = API.getDownloadUrl(doc.id);
    right.appendChild(downloadLink);

    bar.appendChild(left);
    bar.appendChild(center);
    bar.appendChild(right);
    viewer.appendChild(bar);
  }

  function buildSettingsPanel(viewer) {
    settingsPanel = document.createElement('div');
    settingsPanel.className = 'txt-settings-panel';
    settingsPanel.style.display = 'none';

    // Font row
    var fontSel = document.createElement('select');
    fontSel.className = 'txt-settings-select';
    FONTS.forEach(function(f) {
      var opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      if (f.value === txtFont) opt.selected = true;
      fontSel.appendChild(opt);
    });
    fontSel.addEventListener('change', function() {
      txtFont = fontSel.value;
      applySettings();
      API.saveSetting('txt_font', txtFont);
    });
    settingsPanel.appendChild(createSettingRow('Font', fontSel));

    // Font size row
    var sizeSel = document.createElement('select');
    sizeSel.className = 'txt-settings-select';
    FONT_SIZES.forEach(function(s) {
      var opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = s + 'px';
      if (s === txtFontSize) opt.selected = true;
      sizeSel.appendChild(opt);
    });
    sizeSel.addEventListener('change', function() {
      txtFontSize = parseInt(sizeSel.value, 10);
      applySettings();
      API.saveSetting('txt_font_size', String(txtFontSize));
    });
    settingsPanel.appendChild(createSettingRow('Size', sizeSel));

    // Margin row
    var marginSel = document.createElement('select');
    marginSel.className = 'txt-settings-select';
    MARGINS.forEach(function(m) {
      var opt = document.createElement('option');
      opt.value = String(m);
      opt.textContent = m + 'px';
      if (m === txtMargin) opt.selected = true;
      marginSel.appendChild(opt);
    });
    marginSel.addEventListener('change', function() {
      txtMargin = parseInt(marginSel.value, 10);
      applySettings();
      API.saveSetting('txt_margin', String(txtMargin));
    });
    settingsPanel.appendChild(createSettingRow('Margin', marginSel));

    viewer.appendChild(settingsPanel);
  }

  function createSettingRow(label, control) {
    var row = document.createElement('div');
    row.className = 'txt-settings-row';
    var lbl = document.createElement('span');
    lbl.className = 'txt-settings-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(control);
    return row;
  }

  function buildScrollContainer(viewer, content) {
    scrollContainer = document.createElement('div');
    scrollContainer.className = 'txt-scroll-container';

    var pre = document.createElement('pre');
    pre.className = 'txt-content';
    pre.textContent = content;

    scrollContainer.appendChild(pre);
    viewer.appendChild(scrollContainer);

    scrollContainer.addEventListener('scroll', function() {
      scheduleSave();
    });
  }

  function applySettings() {
    if (!scrollContainer) return;
    var pre = scrollContainer.querySelector('.txt-content');
    if (!pre) return;
    pre.style.fontFamily = txtFont;
    pre.style.fontSize = txtFontSize + 'px';
    pre.style.paddingLeft = txtMargin + 'px';
    pre.style.paddingRight = txtMargin + 'px';
  }

  function toggleSettings() {
    settingsPanelVisible = !settingsPanelVisible;
    if (settingsPanel) {
      settingsPanel.style.display = settingsPanelVisible ? 'block' : 'none';
    }
  }

  function restoreScrollPosition() {
    if (!scrollContainer || !doc) return;
    var savedPct = doc.current_page || 0;
    if (savedPct <= 0) return;

    setTimeout(function() {
      if (!scrollContainer) return;
      var maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (maxScroll > 0) {
        scrollContainer.scrollTop = Math.round((savedPct / 10000) * maxScroll);
      }
    }, 100);
  }

  function getScrollPct() {
    if (!scrollContainer) return 0;
    var maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    return maxScroll > 0 ? Math.round((scrollContainer.scrollTop / maxScroll) * 10000) : 0;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      if (doc) {
        API.saveProgress(doc.id, getScrollPct()).catch(function(err) {
          console.error('Failed to save txt progress:', err);
        });
      }
    }, 2000);
  }

  function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Escape' || e.keyCode === 27) {
      cleanup();
      window.history.back();
    }
  }

  function cleanup() {
    document.removeEventListener('keydown', handleKeyboard);
    clearTimeout(saveTimer);

    if (doc && scrollContainer) {
      API.saveProgress(doc.id, getScrollPct()).catch(function() {});
    }

    doc = null;
    scrollContainer = null;
    settingsPanel = null;
    settingsPanelVisible = false;
  }

  return { render: render, cleanup: cleanup };
})();
