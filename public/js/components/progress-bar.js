var ProgressBar = (function() {

  function create() {
    var el = document.createElement('div');
    el.className = 'viewer-progress';

    var bar = document.createElement('div');
    bar.className = 'viewer-progress-bar';
    bar.style.width = '0%';
    el.appendChild(bar);

    return {
      el: el,
      update: function(current, total) {
        var pct = total > 0 ? Math.round((current / total) * 100) : 0;
        bar.style.width = pct + '%';
      },
    };
  }

  return { create: create };
})();
