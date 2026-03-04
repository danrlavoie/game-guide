# Requirements

## Target Device

- iPad 4th generation (A1458/A1459/A1460)
- iOS 10.3.3 (maximum supported version)
- Safari 10
- 1GB RAM (~200-400MB available for Safari)
- 2048x1536 display (264 ppi)
- No App Store access (too old for current apps)

## v1 Features

### Document Library

- Browse documents by folder structure (mirrors filesystem)
- Paginated document listing (50 per page with "Load more")
- Thumbnail previews for each document
- Document metadata display (name, page count, file size)
- Recently viewed documents on home page (5 most recent)
- Search documents by filename

### Document Viewer

- Server-rendered page images (JPEG, 150 DPI)
- Touch navigation: tap right = next, tap left = prev, tap center = toggle toolbar
- Swipe left/right for page turning
- Toolbar with: back button, page indicator, page jump input, spread toggle, alignment toggle, bookmark toggle, bookmarks list, download button
- Progress bar at bottom of screen
- Single-page mode: 3-page preload window (previous, current, next)
- Two-page spread mode: side-by-side display, 6-page preload window (3 pairs)
  - Spread toggle `[1|2]` switches between single and two-page spread
  - Alignment toggle `[L|R]` controls whether page 1 starts on left or right side (visible only in spread mode)
  - Navigation advances by 2 pages in spread mode
  - Edge cases handled: solo first page when right-aligned, solo last page when odd total

### Reading Progress

- Auto-save current page position (debounced, every 2 seconds)
- Resume reading from last position
- Per-device tracking (cookie-based, no login)

### Page Bookmarks

- Bookmark pages within a book, optionally with a label (up to 100 characters)
- Star icon in viewer toolbar toggles bookmark on current page (outline ☆ / filled ★)
- Dropdown panel below toolbar lists all bookmarks with page numbers and labels
- Click a bookmark to jump-navigate to that page (respects spread mode page pairing)
- Inline label editing (tap edit, type label, save on Enter/blur)
- Bookmarks can be deleted from the panel
- Documents with bookmarks show a gold star badge on the browse page card thumbnail
- Bookmarks are per-device (scoped by device cookie, no login)

### Text Viewer

- Plain text (.txt) file support with continuous scrolling
- Scrollable `<pre>` rendering (no pagination)
- Font family selection (Menlo, Courier New, Monaco — differences visible only on macOS/iOS)
- Font size adjustment (11-20px)
- Margin/padding control (0-64px)
- Scroll position persistence (percentage-based, 0-10000 scale stored in `current_page`)
- Settings accessible from both text viewer Aa panel and Settings page
- Progress bar showing scroll position

### Settings

- Settings page accessible from home screen header
- Dark/light mode toggle with iOS-style switch
- Default view mode toggle (single page / two-page spread)
- Text font, font size, and margin preferences (device-level)
- Per-device settings stored in database (key-value)
- Per-document settings stored in database (device + document + key-value)
  - Spread mode override (overrides device default for a specific book)
  - Page 1 alignment (left or right, per-book)
- Theme persists across sessions with no flash of wrong theme on load
- CSS custom properties for theming; viewer always uses its own dark styling

### File Support

- PDF files (rendered via `pdftoppm`)
- CBZ files (comic book ZIP archives, extracted via `unzip`)
- CBR files (comic book RAR archives, extracted via `unrar`)
- TXT files (served raw, rendered client-side in `<pre>` element)

## Non-Functional Requirements

- LAN-only access (no internet required, no authentication)
- Docker-hosted on UnRAID server
- Single mount point for document directory (read-only)
- Persistent data volume for DB and cache
- Pages must load in under 2 seconds over LAN
- Viewer must not crash Safari (stay under memory limits)

## Future Features

- Favorites
  - Both being able to favorite a particular book, surfacing it in a new special carousel or grid or list alongside the recent books.
- ~~Bookmarking~~ (implemented — star toggle in viewer toolbar, dropdown panel with labeled bookmarks, jump navigation respecting spread mode, inline label editing, delete support, gold star badge on browse page cards)
- Notes and annotations
- Chapter navigation (PDF table of contents)
- Related documents grouping
- ~~Plain text (.txt) file support~~ (implemented — font changer works, visual differences only on macOS/iOS devices with Menlo/Monaco; font preferences accessible from Settings page and text viewer Aa panel; margin controls horizontal padding; progress bar displayed at bottom of text viewer; documentation updated)
- ~~Landscape / two-page spread mode~~ (implemented)
- Additional user settings (font size, page quality, etc.)
- server crash, on restart, seems to skip trying to build thumbnails?
