# Memory: Sharp Cache and Thumbnail Batch OOM

## The Problem

During a fresh startup scan of ~13,000 documents, the server crashed at around 7,500 thumbnails with no error message — just Node's `--watch` mode reporting "Failed running 'server/index.js'. Waiting for file changes before restarting..." This is characteristic of an OOM (out-of-memory) kill, where the OS terminates the process before Node can print an error.

## Root Cause

The `sharp` image processing library maintains an internal decoded image cache by default. This cache stores pixel data from recently processed images so that repeated operations on the same source file can skip the decode step.

In our thumbnail pipeline, every operation is on a different source file — we extract the first image from an archive, resize it to a 200px-wide JPEG, and move on. The cache was storing decoded pixel data from already-completed thumbnails that would never be reused. Over thousands of thumbnails, this accumulated into hundreds of megabytes of retained memory.

The batch runs 5 thumbnails in parallel, each involving:

1. Spawning an external process (`unrar`/`unzip`) to extract an image from an archive over SMB
2. Decoding the extracted image into raw pixels via sharp/libvips
3. Resizing and encoding to JPEG
4. Writing to disk

Steps 2-3 produce raw pixel buffers (a single decoded magazine page scan at 300 DPI can be 10-30MB of raw pixel data). With sharp's cache retaining these buffers, memory grew linearly with the number of completed thumbnails until the OS killed the process.

## The Fix

```js
var sharp = require('sharp');
sharp.cache(false);
```

One line, called once at module load in `server/services/thumbnail.js`. This tells sharp not to cache decoded image data between operations. Each thumbnail's pixel buffers are freed immediately after the resize/encode completes.

## Why This Costs Us Nothing

Sharp's cache is designed for workflows where the same source image is processed multiple times (e.g., generating multiple crop sizes from one upload). In our codebase:

- **Thumbnail generation**: Every source is a different file. The cache stores data that will never be reused.
- **On-demand page rendering**: Sharp is only used in `renderer.js` for converting non-JPEG archive images to JPEG. The result is written to the disk cache (`data/pages/<docId>/<pageNum>.jpg`), so the same source is never processed twice — subsequent requests serve the cached file directly via `res.sendFile()`.

In both cases, sharp's cache provides zero benefit and acts as a pure memory liability.

## Detecting Similar Issues in the Future

OOM kills are silent — no stack trace, no error event, no unhandled rejection. Signs to look for:

- Node process exits mid-operation with no error output
- `--watch` mode reports "Failed running" without a preceding error
- The crash happens at a consistent point in a large batch (e.g., always around 7,000-8,000 items)
- `dmesg` or system logs show an OOM kill for the Node process

If a similar issue recurs, check:

1. Whether any library is caching decoded data between independent operations
2. Whether batch concurrency is too high (our thumbnail batch size of 5 is conservative, but over SMB each operation holds buffers longer)
3. Whether `process.memoryUsage()` logging during batches shows a monotonic increase in `rss` or `heapUsed`
