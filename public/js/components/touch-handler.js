var TouchHandler = (function () {
  function create(container, options) {
    var startX = 0;
    var startY = 0;
    var startTime = 0;
    var isSwiping = false;
    var SWIPE_THRESHOLD = 50;
    var SWIPE_TIME_LIMIT = 500;

    container.addEventListener(
      'touchstart',
      function (e) {
        if (e.touches.length !== 1) return;
        var touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = Date.now();
        isSwiping = true;
      },
      { passive: true }
    );

    container.addEventListener(
      'touchmove',
      function (_e) {
        if (!isSwiping) return;
        // Allow vertical scroll but track horizontal movement
      },
      { passive: true }
    );

    container.addEventListener(
      'touchend',
      function (e) {
        if (!isSwiping) return;
        isSwiping = false;

        var touch = e.changedTouches[0];
        var deltaX = touch.clientX - startX;
        var deltaY = touch.clientY - startY;
        var elapsed = Date.now() - startTime;

        // Check for swipe
        if (
          elapsed < SWIPE_TIME_LIMIT &&
          Math.abs(deltaX) > SWIPE_THRESHOLD &&
          Math.abs(deltaX) > Math.abs(deltaY)
        ) {
          if (deltaX < 0 && options.onSwipeLeft) {
            options.onSwipeLeft();
          } else if (deltaX > 0 && options.onSwipeRight) {
            options.onSwipeRight();
          }
          return;
        }

        // Check for tap (minimal movement)
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && elapsed < 300) {
          var containerWidth = container.offsetWidth;
          var tapX = touch.clientX;

          if (tapX < containerWidth * 0.3) {
            if (options.onTapLeft) options.onTapLeft();
          } else if (tapX > containerWidth * 0.7) {
            if (options.onTapRight) options.onTapRight();
          } else {
            if (options.onTapCenter) options.onTapCenter();
          }
        }
      },
      { passive: true }
    );

    // Mouse support for desktop testing
    var mouseDown = false;
    var mouseStartX = 0;

    container.addEventListener('mousedown', function (e) {
      mouseDown = true;
      mouseStartX = e.clientX;
      startTime = Date.now();
    });

    container.addEventListener('mouseup', function (e) {
      if (!mouseDown) return;
      mouseDown = false;

      var deltaX = e.clientX - mouseStartX;
      var elapsed = Date.now() - startTime;

      if (elapsed < SWIPE_TIME_LIMIT && Math.abs(deltaX) > SWIPE_THRESHOLD) {
        if (deltaX < 0 && options.onSwipeLeft) {
          options.onSwipeLeft();
        } else if (deltaX > 0 && options.onSwipeRight) {
          options.onSwipeRight();
        }
        return;
      }

      if (Math.abs(deltaX) < 10 && elapsed < 300) {
        var containerWidth = container.offsetWidth;
        var tapX = e.clientX;

        if (tapX < containerWidth * 0.3) {
          if (options.onTapLeft) options.onTapLeft();
        } else if (tapX > containerWidth * 0.7) {
          if (options.onTapRight) options.onTapRight();
        } else {
          if (options.onTapCenter) options.onTapCenter();
        }
      }
    });
  }

  return { create: create };
})();
