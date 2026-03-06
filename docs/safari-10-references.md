# Safari 10 Compatibility References

Known issues, spec differences, and workarounds relevant to this project's target platform (iPad 4th gen, iOS 10.3.3, Safari 10).

## Fetch API: `credentials` Default

Safari 10's native `fetch()` implementation uses the original spec default of `credentials: 'omit'`, meaning cookies are never sent or stored unless explicitly opted in. Modern browsers changed the default to `'same-origin'`.

**Impact:** All `fetch()` calls must include `credentials: 'same-origin'` for cookie-based device identification to work.

**References:**

- [whatwg/fetch PR #585](https://github.com/whatwg/fetch/pull/585) — The spec change from `'omit'` to `'same-origin'`
- [Chrome Platform Status: credentials default](https://chromestatus.com/feature/4539473312350208) — Browser shipping timeline; Safari showed "negative signals"
- [JakeChampion/fetch #787](https://github.com/JakeChampion/fetch/issues/787) — Bug report confirming iOS 10 and 11 use the outdated default

**Project fix:** `public/js/api.js` — commit `031beab`. See [docs/cookie-investigation.md](cookie-investigation.md).

## SameSite Cookie Attribute

Safari 10 predates the `SameSite` cookie attribute entirely. Older WebKit versions don't simply ignore unrecognized attributes — they may reject the cookie or misinterpret the value as `Strict`.

**Impact:** Never set `sameSite` on cookies when targeting Safari 10. It's unnecessary for same-origin LAN apps anyway.

**References:**

- [Chromium: SameSite Incompatible Clients](https://www.chromium.org/updates/same-site/incompatible-clients/) — Lists browser versions with known `SameSite` issues
- [WebKit Bug 198181](https://bugs.webkit.org/show_bug.cgi?id=198181) — WebKit treating `SameSite=None` or invalid values as `Strict`
- [Can I Use: SameSite](https://caniuse.com/same-site-cookie-attribute) — Browser support timeline

**Project fix:** `server/middleware/device.js` — commit `0e12b69`. See [docs/cookie-investigation.md](cookie-investigation.md).

## Compositing and Repaint Bugs

iOS Safari 10 can fail to repaint an image region after the image finishes decoding, particularly when the image is appended to the DOM before decode completes and page transitions happen rapidly. The browser thinks the painted region is current when it isn't.

**Impact:** Dynamically inserted `<img>` elements may appear partially rendered. Force a repaint by promoting the element to a compositing layer via `translateZ(0)`.

**References:**

- [Force rendering a DOM element (WebKit workarounds)](https://gist.github.com/madrobby/1362093) — Classic gist documenting `translateZ(0)` and other forced-repaint techniques
- [Safari 10.1 position:fixed repaint bug](https://codepen.io/peterhry/pen/PmMyeB) — Demo of a related Safari 10 repaint issue
- [Debugging Hard Things: Safari Edition](https://gwwar.com/debugging-hard-things-safari-edition/) — General reference for Safari rendering quirks

**Project fix:** `public/js/pages/viewer.js` `forceRepaint()` — commit `f7bdb77`. See [docs/partial-render-investigation.md](partial-render-investigation.md).

## Stacking Contexts

Safari strictly isolates stacking contexts created by `position: fixed` elements with a `z-index`. An element on `document.body` cannot paint above a fixed-position stacking context regardless of its own `z-index` value. Other browsers are more lenient.

**Impact:** Overlays (debug OSD, modals) must be children of the fixed-position container, not siblings or children of `document.body`.

**Project fix:** Debug OSD appended inside `.viewer` instead of `document.body` — commit `46a8137`. See [docs/partial-render-investigation.md](partial-render-investigation.md).

## Unsupported JavaScript APIs

These are also listed in CLAUDE.md but collected here for reference:

| Feature                   | Alternative                                     |
| ------------------------- | ----------------------------------------------- |
| Optional chaining (`?.`)  | Ternary or explicit null checks                 |
| Nullish coalescing (`??`) | `\|\|` for defaults                             |
| `Array.at()`              | Bracket notation (`arr[arr.length - 1]`)        |
| `Object.fromEntries()`    | `forEach` loop building an object               |
| `String.replaceAll()`     | `split().join()` or regex with `g` flag         |
| `fetch()` AbortController | Not available; use timeouts or ignore responses |
| Service Workers           | Not available                                   |
| Intersection Observer     | Scroll event listeners                          |
| Pointer Events            | Touch events + mouse events                     |
| `async`/`await`           | Supported (Safari 10.1+)                        |

## Unsupported CSS Features

| Feature           | Alternative                    |
| ----------------- | ------------------------------ |
| CSS Grid          | Flexbox                        |
| `gap` on flexbox  | Margins on children            |
| `dvh`/`svh` units | `vh` or JavaScript measurement |
