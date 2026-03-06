# Game Guide - AI Agent Instructions

## Project Overview

A client-server web app that serves PDF, CBZ, CBR, and TXT game manuals/strategy guides to an old iPad 4th gen (iOS 10.3.3, Safari 10) over LAN. Server-side rendering converts pages to JPEG images; the frontend is a vanilla JS single-page app.

## Key Directories

- `server/` - Node.js + Express backend
  - `server/routes/` - Express route handlers for API endpoints
  - `server/services/` - Core business logic (scanner, renderer, thumbnails)
  - `server/middleware/` - Express middleware (device identification)
  - `server/utils/` - Shared utilities
- `public/` - Static frontend served by Express
  - `public/js/pages/` - Page-level view modules (home, browse, search, viewer, settings)
  - `public/js/components/` - Reusable UI components
  - `public/css/` - Stylesheets
- `docs/` - Architecture and requirements documentation
- `data/` - Runtime data (SQLite DB, cached pages, thumbnails) - gitignored

## Coding Conventions

- **Backend:** Node.js with CommonJS (`require`/`module.exports`)
- **Frontend:** Vanilla ES6 JavaScript. NO frameworks, NO build step, NO transpilation
- **ES6 only:** Do NOT use optional chaining (`?.`), nullish coalescing (`??`), `Array.at()`, or any post-ES6 syntax. These are unsupported on Safari 10.
- **Safe alternatives:** Use ternary operators, `||` for defaults, bracket notation for property access
- **No canvas rendering:** Use `<img>` tags for page display to stay under Safari's 5-megapixel canvas limit
- **CSS:** No CSS Grid (Safari 10 has partial support). Use Flexbox for layouts.
- **Theming:** All colors use CSS custom properties (`var(--name)`). Light defaults on `:root`, dark overrides on `[data-theme="dark"]`. Viewer CSS is excluded (always dark).
- **Logging:** Use Pino via `server/logger.js`. Do NOT use `console.log`, `console.error`, `console.warn`, or `process.stdout.write`. Create child loggers per module: `var log = require('./logger').child({ component: 'name' })`. Use structured key-value metadata: `log.info({ count: 5, file: path }, 'Message')`. Pino writes to stderr; stdout is unused.

## Safari 10 Compatibility - APIs to AVOID

- Optional chaining (`?.`) and nullish coalescing (`??`)
- `Array.at()`, `Object.fromEntries()`, `String.replaceAll()`
- Service Workers, Pointer Events, Intersection Observer
- CSS Grid, `gap` on flexbox, `dvh`/`svh` units
- `fetch()` AbortController
- `fetch()` without `credentials: 'same-origin'` (Safari 10 defaults to `'omit'`)
- Cookie `sameSite` attribute (Safari 10 may reject the cookie entirely)
- `async`/`await` IS supported (Safari 10.1+)

See [docs/safari-10-references.md](docs/safari-10-references.md) for detailed explanations, external references, and project-specific fixes.

## Testing

- **Local dev:** `npm run dev` starts server with `--watch` on port 3000
- **Docker:** `docker compose up --build` from project root
- **iPad:** Navigate to `http://<server-ip>:3000` on iPad Safari
- Verify page rendering, touch navigation, progress persistence, memory stability

## Database

- SQLite at `data/game-guide.db`
- Schema defined in `server/db.js`
- Tables: `documents`, `devices`, `reading_progress`, `device_settings`, `document_settings`, `bookmarks`, `favorites`

## Architecture Decisions - Do NOT Change

- Server-side PDF rendering via `pdftoppm` (not PDF.js) - critical for iPad compatibility
- `<img>` tags for page display (not `<canvas>`) - avoids 5MP canvas limit
- 3-page preload window in viewer (6 in spread mode) - keeps memory under control
- Hash-based routing (`#/path`) - no History API for simplicity
- Cookie-based device UUID - no login system
- Single Docker container with all dependencies
