# Partial Image Rendering Investigation

## Problem

When reading on the iPad (Safari 10, iOS 10.3.3) and flipping pages quickly with short taps, some pages render as a tiny rectangle of pixels (~0.25" x 0.75") centered on screen instead of the full page image. The issue:

- Occurs during quick taps (finger touch and immediate release)
- Does not occur with slow taps (hold for ~1 second, then release)
- Primarily observed in single-page mode, not spread (two-page) mode
- Resolves on its own when leaving the page and returning — the full image renders correctly on revisit

## Architecture Context

The viewer uses a preload window pattern:

1. `getImage(pageNum)` creates an `Image` object and sets `img.src` to the server endpoint
2. Images are cached in a `preloadedImages` object (3-page window in single mode, 6 in spread)
3. `showPage()` retrieves the image from cache and either:
   - **Fast path**: if `img.complete && img.naturalWidth`, appends immediately (no wait)
   - **Normal path**: sets `img.onload` to append when fully loaded
4. Server renders pages on-demand and caches the JPEG to disk for subsequent requests

## Investigation Steps

### Step 1: Initial Hypothesis — `img.complete` Race Condition

**Hypothesis:** The fast path check (`img.complete && img.naturalWidth`) was firing for partially-loaded images. JPEG files expose `naturalWidth`/`naturalHeight` as soon as the header is parsed (first few hundred bytes), well before all pixel data has arrived. `img.complete` can also be `true` while a response is still streaming.

When flipping quickly, the preloaded image for the next page may have started loading but not finished. The fast path would append it immediately with only partial pixel data — producing the tiny rendered rectangle.

**Why spread mode was less affected:** Spread mode requires both left and right images to be ready via a `tryFinish()` synchronization function, giving each image more time to fully load before display.

**Fix applied (commit 7eb7336):** Added an explicit `_loaded` flag set only inside `onload` handlers. Replaced all `img.complete && img.naturalWidth` checks with `img._loaded` to guarantee the image is fully decoded before the fast path fires.

**Result:** Did not fix the issue. The partial rendering still occurs on the iPad.

### Step 2: Adding Debug OSD

Since Safari on iPad (iOS 10) can't be debugged remotely from Linux (requires macOS Safari for Web Inspector), we added an on-screen debug overlay to the viewer to observe image state in real time.

**OSD displays (updated every 200ms):**

- Current page number and mode (single/spread)
- Number of `<img>` elements in the DOM
- Per-image properties: `complete`, `naturalWidth x naturalHeight`, `display width x height`, `_loaded` flag
- Preload cache status: which pages are ready vs still pending
- Whether the "Loading..." message div is visible

**First attempt (commit 917d3d4):** Appended OSD to `document.body` with `position: fixed` and `z-index: 99999`. Worked on desktop Firefox but was invisible on iPad Safari.

**Root cause:** The `.viewer` element is `position: fixed` with `z-index: 100`, creating its own stacking context. On Safari, an element on `document.body` cannot paint above a fixed-position stacking context regardless of z-index — stacking contexts are resolved independently.

**Fix (commit 46a8137):** Moved OSD inside the viewer element with `position: absolute` and `z-index: 200` (above the toolbar's 110 and bookmark panel's 120).

**Status:** Waiting for CI to deploy so we can test on iPad with visible OSD.

## Next Steps

- Observe OSD output on iPad when the partial render occurs
- Determine whether `_loaded` is correctly `false` when the bug triggers (meaning the fast path fix is working but the normal `onload` path also has an issue)
- Or discover a different root cause visible in the debug data

## Related Commits

| Commit    | Description                                          |
| --------- | ---------------------------------------------------- |
| `7eb7336` | Replace `img.complete` fast path with `_loaded` flag |
| `917d3d4` | Add debug OSD overlay to viewer                      |
| `46a8137` | Fix OSD visibility on iPad (stacking context)        |
