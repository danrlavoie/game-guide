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
- Toolbar with: back button, page indicator, page jump input, download button
- Progress bar at bottom of screen
- 3-page preload window (previous, current, next)

### Reading Progress
- Auto-save current page position (debounced, every 2 seconds)
- Resume reading from last position
- Per-device tracking (cookie-based, no login)

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

## Future Features (Not in v1)
- Favorites / bookmarks
- Notes and annotations
- Dark mode
- Chapter navigation (PDF table of contents)
- Related documents grouping
- Plain text (.txt) file support
- Landscape / two-page spread mode
