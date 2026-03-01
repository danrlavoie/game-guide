# Architecture

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | Node.js + Express | Simple, mature, serves both API and static frontend |
| Database | SQLite via `better-sqlite3` | Zero-config, single-file, perfect for single-user LAN app |
| PDF rendering | `pdftoppm` (poppler-utils) | Server-side PDF-to-JPEG conversion; avoids client-side memory/compatibility issues |
| Image processing | `sharp` | Fast thumbnail generation |
| Frontend | Vanilla ES6 JavaScript | No framework, no build step, ships directly to Safari 10 |
| Container | Docker on UnRAID | Single container serves everything |

### Why Server-Side Rendering Instead of PDF.js

- PDF.js v2.x has known bugs on iOS 10 Safari
- Safari's canvas limit (5 megapixels) makes client-side rendering fragile
- 1GB total RAM means Safari can crash rendering complex PDFs
- Server-side `pdftoppm` at 150 DPI produces ~100-300KB JPEGs per page
- The viewer uses `<img>` tags, which Safari handles efficiently

## System Diagram

```
┌─────────────────────────────────────────────────┐
│  Docker Container                               │
│                                                 │
│  ┌──────────────┐    ┌────────────────────┐     │
│  │  Express      │    │  /documents (ro)   │     │
│  │  Server       │───>│  PDF/CBZ/CBR files  │     │
│  │  Port 3000    │    └────────────────────┘     │
│  │               │                               │
│  │  - Static     │    ┌────────────────────┐     │
│  │    files      │    │  /data             │     │
│  │  - API        │───>│  SQLite DB         │     │
│  │  - Page       │    │  Cached pages      │     │
│  │    rendering  │    │  Thumbnails        │     │
│  └──────┬───────┘    └────────────────────┘     │
│         │                                        │
└─────────┼────────────────────────────────────────┘
          │ LAN
    ┌─────┴─────┐
    │  iPad 4    │
    │  Safari 10 │
    │  iOS 10.3  │
    └───────────┘
```

## Data Flow

### Scanning Pipeline
1. On startup (+ manual trigger + optional timer), walk documents directory
2. Collect *.pdf, *.cbz, and *.cbr files, compute relative paths + partial hash (first 64KB SHA-256)
3. Sync with DB: insert new, update changed (invalidate cache), remove deleted
4. Extract page count via `pdfinfo` (PDF), `unzip -l` (CBZ), or `unrar lb` (CBR)
5. Queue thumbnail generation for new documents

### On-Demand Page Rendering
1. Client requests `/api/documents/:id/pages/:pageNum`
2. Check disk cache (`data/pages/<doc_id>/<page>.jpg`)
3. If cached, serve directly. If not:
   - PDF: Run `pdftoppm` for single page at 150 DPI -> JPEG
   - CBZ: Extract image from ZIP archive via `unzip`
   - CBR: Extract image from RAR archive via `unrar`
4. Save to cache, serve response

### Device Identification
- No login. UUID stored in persistent cookie (10-year expiry)
- Falls back to IP address if cookies fail
- Tracks reading progress, recently viewed, and per-device settings

### Theming
- CSS custom properties (`:root` for light, `[data-theme="dark"]` for dark)
- Theme preference stored per device in `device_settings` table
- FOUC prevention via synchronous XHR in `<head>` that fetches theme before first paint
- Viewer page is excluded from theming (always uses its own dark styling)

## Safari 10 Constraints

These constraints shaped the frontend architecture:

| Constraint | Impact |
|-----------|--------|
| ~200-400MB available RAM | Server-side rendering, 3-page preload window |
| 5-megapixel canvas limit | Use `<img>` tags, not `<canvas>` |
| No Service Workers | No offline support, no caching strategies |
| No Pointer Events | Use Touch Events + Mouse Events separately |
| No Intersection Observer | Manual scroll-based visibility checks |
| No CSS Grid (reliable) | Flexbox-only layouts |
| No `?.` or `??` operators | ES6 alternatives only |

## Database Schema

### documents
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| file_path | TEXT UNIQUE | Relative path from documents root |
| file_name | TEXT | Display name |
| file_type | TEXT | 'pdf', 'cbz', or 'cbr' |
| file_size | INTEGER | Bytes |
| page_count | INTEGER | Number of pages |
| parent_folder | TEXT | Parent directory path |
| file_hash | TEXT | SHA-256 of first 64KB for change detection |
| thumbnail_generated | INTEGER | Boolean (0/1) |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### devices
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID from cookie |
| ip_address | TEXT | Fallback identifier |
| user_agent | TEXT | Browser UA string |
| last_seen_at | TEXT | ISO timestamp |

### reading_progress
| Column | Type | Description |
|--------|------|-------------|
| device_id | TEXT | FK to devices |
| document_id | INTEGER | FK to documents |
| current_page | INTEGER | Last viewed page |
| last_read_at | TEXT | ISO timestamp |
| UNIQUE | | (device_id, document_id) |

### device_settings
| Column | Type | Description |
|--------|------|-------------|
| device_id | TEXT | FK to devices |
| setting_key | TEXT | Setting name (e.g. 'theme') |
| setting_value | TEXT | Setting value (e.g. 'dark') |
| updated_at | TEXT | ISO timestamp |
| PRIMARY KEY | | (device_id, setting_key) |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/documents` | List documents + subfolders (paginated, filterable by folder) |
| GET | `/api/documents?recent=true` | Recently viewed by this device |
| GET | `/api/documents/:id` | Document detail |
| GET | `/api/documents/:id/pages/:pageNum` | Rendered page as JPEG |
| GET | `/api/documents/:id/thumbnail` | Thumbnail image (200px wide) |
| GET | `/api/documents/:id/download` | Download original file |
| GET | `/api/search?q=term` | Search by filename/path |
| GET/PUT | `/api/documents/:id/progress` | Read/save reading progress |
| GET | `/api/settings` | Get all settings for current device |
| PUT | `/api/settings` | Upsert a setting (`{ key, value }`) |
| POST | `/api/scan` | Trigger directory re-scan |
