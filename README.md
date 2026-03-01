# Game Guide

A PDF/CBZ/CBR reader web app designed for reading game manuals and strategy guides on a legacy iPad 4th gen (iOS 10.3.3) over LAN. The server renders PDF pages to JPEG images, so the iPad just displays `<img>` tags - no heavy client-side processing.

## Quick Start

### Prerequisites
- Node.js 20+
- `poppler-utils` installed (`pdftoppm`, `pdfinfo`)
- `unrar` installed (for CBR support)
- A directory of PDF/CBZ/CBR files to serve

### Local Development

```bash
npm install
DOCUMENTS_PATH=/path/to/your/documents npm run dev
```

Visit `http://localhost:3000` in a browser.

### Docker (Recommended)

Edit `docker-compose.yml` to point at your documents directory, then:

```bash
docker compose up --build
```

Access from iPad at `http://<server-ip>:3000`.

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DOCUMENTS_PATH` | `/documents` | Path to mounted document directory |
| `DATA_PATH` | `./data` | Path for SQLite DB + page cache |
| `PAGE_DPI` | `150` | DPI for PDF page rendering |
| `THUMBNAIL_WIDTH` | `200` | Thumbnail width in pixels |

## Project Structure

```
server/           # Node.js + Express backend
  index.js        # App entry point
  config.js       # Environment configuration
  db.js           # SQLite schema and helpers
  middleware/     # Device identification
  routes/         # API route handlers
  services/       # Scanner, renderer, thumbnails
public/           # Static frontend (vanilla ES6 JS)
  index.html      # Single-page app shell
  css/            # Stylesheets
  js/             # Application JavaScript
docs/             # Architecture and requirements docs
```

## How It Works

1. **Scanning:** On startup, the server scans the documents directory for PDF/CBZ/CBR files and catalogs them in SQLite
2. **Browsing:** The web UI shows folders and documents with thumbnail previews
3. **Reading:** When you open a document, pages are rendered server-side to JPEG and streamed to the browser as `<img>` tags
4. **Progress:** Your reading position is saved automatically per device (identified by cookie)
5. **Settings:** Dark/light mode toggle and other per-device preferences via the Settings page
