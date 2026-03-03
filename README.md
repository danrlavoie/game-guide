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

```bash
docker compose up --build
```

Access from iPad at `http://<server-ip>:3000`.

All settings can be overridden with environment variables:

```bash
HOST_PORT=8080 DOCUMENTS_PATH=/my/docs DATA_PATH=/my/data docker compose up --build
```

### UnRAID

Add the container through the UnRAID Docker UI with the following mappings:

**Ports:**

| Name   | Container Port | Host Port               |
| ------ | -------------- | ----------------------- |
| Web UI | `3000`         | `3000` (or your choice) |

**Paths:**

| Name      | Container Path | Host Path                                | Mode       |
| --------- | -------------- | ---------------------------------------- | ---------- |
| Documents | `/documents`   | `/mnt/user/Game books magazines manuals` | Read Only  |
| Data      | `/data`        | `/mnt/user/appdata/game-guide/data`      | Read/Write |

**Variables (optional):**

| Name              | Default | Description                                                  |
| ----------------- | ------- | ------------------------------------------------------------ |
| `PAGE_DPI`        | `150`   | DPI for rendered page JPEGs (higher = sharper, larger files) |
| `THUMBNAIL_WIDTH` | `200`   | Thumbnail width in pixels                                    |
| `PAGE_QUALITY`    | `85`    | JPEG quality for rendered pages (1-100)                      |
| `SCAN_INTERVAL`   | `0`     | Auto-rescan interval in minutes (0 = manual only)            |

## Configuration

All configuration is via environment variables. In Docker, these are set through `docker-compose.yml` or the UnRAID Docker UI. For local development, pass them on the command line.

| Variable          | Default (Docker)                         | Default (Local) | Description                                       |
| ----------------- | ---------------------------------------- | --------------- | ------------------------------------------------- |
| `HOST_PORT`       | `3000`                                   | n/a             | Host port mapped to container port 3000           |
| `DOCUMENTS_PATH`  | `/mnt/user/Game books magazines manuals` | `/documents`    | Path to document directory                        |
| `DATA_PATH`       | `/mnt/user/appdata/game-guide/data`      | `./data`        | Path for SQLite DB, page cache, thumbnails        |
| `PAGE_DPI`        | `150`                                    | `150`           | DPI for PDF page rendering                        |
| `THUMBNAIL_WIDTH` | `200`                                    | `200`           | Thumbnail width in pixels                         |
| `PAGE_QUALITY`    | `85`                                     | `85`            | JPEG quality for rendered pages                   |
| `SCAN_INTERVAL`   | `0`                                      | `0`             | Auto-rescan interval in minutes (0 = manual only) |

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
