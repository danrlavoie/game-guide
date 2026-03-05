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
   - **Fast path**: if the image is already loaded, appends immediately (no wait)
   - **Normal path**: sets `img.onload` to append when fully loaded
4. Server renders pages on-demand and caches the JPEG to disk for subsequent requests

## Investigation Steps

### Step 1: Initial Hypothesis — `img.complete` Race Condition

**Hypothesis:** The fast path check (`img.complete && img.naturalWidth`) was firing for partially-loaded images. JPEG files expose `naturalWidth`/`naturalHeight` as soon as the header is parsed (first few hundred bytes), well before all pixel data has arrived. `img.complete` can also be `true` while a response is still streaming.

When flipping quickly, the preloaded image for the next page may have started loading but not finished. The fast path would append it immediately with only partial pixel data — producing the tiny rendered rectangle.

**Why spread mode was less affected:** Spread mode requires both left and right images to be ready via a `tryFinish()` synchronization function, giving each image more time to fully load before display.

**Fix applied (commit 7eb7336):** Added an explicit `_loaded` flag set only inside `onload` handlers. Replaced all `img.complete && img.naturalWidth` checks with `img._loaded` to guarantee the image is fully decoded before the fast path fires.

**Result:** Did not fix the issue. The partial rendering still occurs on the iPad. However, the `_loaded` fix was retained as a correctness improvement — `img.complete` was genuinely unreliable for in-flight images.

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

### Step 3: OSD Observations — The Key Clue

With the OSD visible on iPad, the debug data showed:

```
page=1/417 mode=single
imgs in DOM: 1
  img[0] complete=true natural=4784x6755 display=768x928 _loaded=true
cache: 2 (ready=[1,2] pending=[])
loading msg: none
```

Two critical observations:

1. **Image dimensions were enormous:** `4784x6755` = 32.3 megapixels. This comes from a game guide PDF with oversized page dimensions (roughly 32" x 45" at 150 DPI). Initially this seemed like it might exceed Safari's ~16.7MP image limit, but the next clue ruled that out.

2. **The OSD itself revealed the rendering:** The portion of the page image _behind the OSD_ was rendering correctly. The area outside the OSD showed only the tiny rectangle on a dark gray background. This meant the image data was fully loaded and decoded — Safari just wasn't painting it.

This ruled out the megapixel hypothesis (Safari would subsample or reject the whole image, not render only part of it) and pointed to a **compositing/repaint bug**.

### Step 4: Root Cause — Safari Compositing Repaint Bug

**Root cause:** iOS Safari 10 has a rendering bug where it can skip repainting an image region after the image finishes decoding, particularly when:

- The image is appended to the DOM before decoding completes
- Page transitions happen rapidly (the compositor thinks the painted region is current when it isn't)

The OSD was accidentally forcing a repaint in its region because its semi-transparent `background: rgba(0,0,0,0.8)` causes Safari to composite that area as a separate layer, which triggers a paint pass for the underlying content.

**Fix (commit f7bdb77):** Added a `forceRepaint()` function that:

1. Reads `el.offsetHeight` — forces a synchronous layout calculation
2. Sets `webkitTransform: translateZ(0)` — promotes the element to a compositing layer, forcing Safari to do a full paint pass
3. Removes the transform on the next frame via `setTimeout(fn, 0)` — avoids keeping an unnecessary compositing layer

This is called after every image append in both single and spread modes.

**Result:** Fixed the issue. Rapid page flips on the 32MP document now render correctly every time.

## Lessons Learned

1. **`img.complete` is unreliable** for images that are still loading. Use explicit flags set in `onload` handlers.

2. **Stacking contexts in Safari** are strict. A `position: fixed` element with a z-index creates an isolated stacking context — children of `document.body` cannot paint above it regardless of their own z-index.

3. **Safari compositing bugs** can cause images to appear partially painted. The classic fix is to force a repaint by promoting the element to its own compositing layer via `translateZ(0)`.

4. **Debug OSD overlays** are invaluable when remote debugging isn't available. The OSD not only showed us the image state but also _accidentally revealed the root cause_ by forcing repaints in its own region.

5. **Large PDF page dimensions** can produce unexpectedly huge rendered images. A document at 150 DPI with 32" x 45" pages produces 32MP images — worth considering a max dimension cap in the renderer for future robustness.

## Related Commits

| Commit    | Description                                          |
| --------- | ---------------------------------------------------- |
| `7eb7336` | Replace `img.complete` fast path with `_loaded` flag |
| `917d3d4` | Add debug OSD overlay to viewer                      |
| `46a8137` | Fix OSD visibility on iPad (stacking context)        |
| `f7bdb77` | Force repaint after image append (the actual fix)    |

## Debug OSD

The debug OSD is retained as a diagnostic tool, controlled by the `DEBUG_OSD` environment variable. Set `DEBUG_OSD=1` or `DEBUG_OSD=true` to enable it. It can be passed through docker-compose or set directly when running the server. See the environment variables section in the docker-compose.yml.
