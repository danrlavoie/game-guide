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
- Toolbar with: back button, page indicator, page jump input, spread toggle, alignment toggle, download button
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

### Settings
- Settings page accessible from home screen header
- Dark/light mode toggle with iOS-style switch
- Default view mode toggle (single page / two-page spread)
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

## Non-Functional Requirements
- LAN-only access (no internet required, no authentication)
- Docker-hosted on UnRAID server
- Single mount point for document directory (read-only)
- Persistent data volume for DB and cache
- Pages must load in under 2 seconds over LAN
- Viewer must not crash Safari (stay under memory limits)

## Future Features
- Favorites / bookmarks
  - Both being able to favorite a particular book, and being able to mark pages within a book as bookmarked, optionally with a name e.g. "cheat codes here", therefore making that page easily navigable when reading the book
- Notes and annotations
- Chapter navigation (PDF table of contents)
- Related documents grouping
- Plain text (.txt) file support
  - Not sure if font family changer actually works
  - Are font preferences a Setting and should they be accessible from the Settings page?
  - Seems like margin select might be unnecessary as the txt files wrap properly
  - Should/does a progress bar display while reading the txt file?
  - Documentation (i.e. here and other places) needs to be updated to account for txt support
- ~~Landscape / two-page spread mode~~ (implemented)
- Additional user settings (font size, page quality, etc.)
- server crash, on restart, seems to skip trying to build thumbnails?
