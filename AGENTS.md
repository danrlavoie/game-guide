# Game Guide - AI Agent Instructions

## Project Overview
A client-server web app that serves PDF and CBZ game manuals/strategy guides to an old iPad 4th gen (iOS 10.3.3, Safari 10) over LAN. Server-side rendering converts pages to JPEG images; the frontend is a vanilla JS single-page app.

## Key Directories
- `server/` - Node.js + Express backend
  - `server/routes/` - Express route handlers for API endpoints
  - `server/services/` - Core business logic (scanner, renderer, thumbnails)
  - `server/middleware/` - Express middleware (device identification)
  - `server/utils/` - Shared utilities
- `public/` - Static frontend served by Express
  - `public/js/pages/` - Page-level view modules (home, browse, search, viewer)
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

## Safari 10 Compatibility - APIs to AVOID
- Optional chaining (`?.`) and nullish coalescing (`??`)
- `Array.at()`, `Object.fromEntries()`, `String.replaceAll()`
- Service Workers, Pointer Events, Intersection Observer
- CSS Grid, `gap` on flexbox, `dvh`/`svh` units
- `fetch()` AbortController
- `async`/`await` IS supported (Safari 10.1+)

## Testing
- **Local dev:** `npm run dev` starts server with `--watch` on port 3000
- **Docker:** `docker compose up --build` from project root
- **iPad:** Navigate to `http://<server-ip>:3000` on iPad Safari
- Verify page rendering, touch navigation, progress persistence, memory stability

## Database
- SQLite at `data/game-guide.db`
- Schema defined in `server/db.js`
- Tables: `documents`, `devices`, `reading_progress`

## Architecture Decisions - Do NOT Change
- Server-side PDF rendering via `pdftoppm` (not PDF.js) - critical for iPad compatibility
- `<img>` tags for page display (not `<canvas>`) - avoids 5MP canvas limit
- 3-page preload window in viewer - keeps memory under control
- Hash-based routing (`#/path`) - no History API for simplicity
- Cookie-based device UUID - no login system
- Single Docker container with all dependencies
