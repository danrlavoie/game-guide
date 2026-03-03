# Performance: Scanning Pipeline

This document describes the bottlenecks discovered in the original scanning pipeline and the optimizations applied to address them. The test case is a document library of ~10,000 PDF/CBZ/CBR files mounted over SMB on an UnRAID server.

## The Problem

The original scanning pipeline took approximately 30 minutes to complete on a fresh startup with 10,000 documents. During this time, the server was technically running and accepting requests, but the `scan()` promise didn't resolve until all post-processing (page counts and thumbnails) finished. Manual scans via the UI's Scan button also blocked until complete.

## V1: Original Approach

The original pipeline had four sequential phases, all blocking the scan promise:

### Phase 1: Walk + Hash + Catalog (synchronous, in transaction)

For every file found on disk:

1. Read the first 64KB of the file and compute a SHA-256 hash
2. Call `fs.statSync()` to get the file size
3. Compare the hash against the database to detect changes
4. Insert or update the database row

**Bottleneck:** Every file was hashed on every scan, even if nothing changed. With 10,000 files, this meant 10,000 synchronous file opens, 64KB reads, and SHA-256 computations — roughly 640MB of I/O. On an SMB mount, each file open has network latency. On a fresh scan, hashing was entirely wasted because there were no existing hashes to compare against.

The `statSync()` call was also redundant — it was called inside the transaction loop, but the same information could have been collected during the directory walk.

### Phase 2: Page Count Extraction (batched, 10 concurrent)

For each new or changed document, an external command was spawned to extract the page count:

- PDFs: `pdfinfo` (grep for "Pages:" line)
- CBZ: `unzip -l` (count image file entries)
- CBR: `unrar lb` (count image file entries)

These ran in batches of 10 via `Promise.all()`, with batches chained sequentially.

**Bottleneck:** These are lightweight, read-only commands that produce small stdout. A batch size of 10 meant 1,000 sequential rounds for 10,000 files. Each round had to wait for the slowest command in the batch before starting the next.

### Phase 3: Thumbnail Generation (fully sequential)

Each new or changed document had its first page rendered to a thumbnail:

- PDFs: `pdftoppm` at 72 DPI, then `sharp` resize to 200px wide
- CBZ/CBR: extract first image from archive, then `sharp` resize

**Bottleneck:** Thumbnails were generated one at a time, serially. Each thumbnail involved spawning an external process plus a `sharp` decode/encode cycle. At roughly 1 second per thumbnail, 10,000 thumbnails would take nearly 3 hours.

### Phase 4: Resolution

The scan promise only resolved after all three phases completed. This meant the caller (startup log, manual scan API response) waited for the entire pipeline.

## V2: Optimized Approach

### Change 1: Mtime-based skip (eliminates hashing on re-scans)

The `documents` table now stores `file_mtime` (the file's modification timestamp in milliseconds) alongside `file_size`. The change detection logic is now:

1. If a file exists in the DB and both `file_size` and `file_mtime` match the file on disk, **skip it entirely**. No file I/O, no hash computation.
2. If size or mtime differ, compute the partial hash and compare it to detect actual content changes. Update the stored mtime so future scans skip the file.
3. If a file is new (not in the DB), insert it **without hashing** — there's no previous hash to compare against, so computing one is pointless.

**Impact on re-scans:** When nothing has changed, the entire catalog phase becomes a fast in-memory comparison of size + mtime values. No files are opened. A re-scan of 10,000 unchanged files completes in seconds instead of minutes.

**Impact on fresh scans:** No hashing occurs at all. Each file is stat'd once (during the walk) and inserted into the database. The 640MB of hash I/O is eliminated entirely.

### Change 2: Stat during walk (eliminates redundant statSync)

`walkDirectory()` now calls `fs.statSync()` once per file during traversal and returns `{fullPath, relativePath, size, mtime}`. The transaction loop uses these pre-collected values instead of calling `statSync()` a second time. This eliminates 10,000 redundant stat calls (which on SMB are network round-trips).

### Change 3: Increased page count concurrency (batch size 10 → 50)

The batch size for `updatePageCounts()` was increased from 10 to 50. These commands (`pdfinfo`, `unzip -l`, `unrar lb`) are lightweight: they read metadata or list archive contents without extracting anything. Their stdout fits easily in the 10MB buffer. Running 50 in parallel cuts the number of sequential rounds from 1,000 to 200 for 10,000 files.

### Change 4: Parallel thumbnail generation (sequential → batches of 5)

`generateBatch()` was changed from fully sequential to batched parallel, using the same pattern as `updatePageCounts()`. A batch size of 5 is conservative — each thumbnail involves spawning an external process and running a `sharp` decode/encode — but still provides a ~5x speedup over serial processing.

### Change 5: Deferred background processing

`scan()` now returns `{result, backgroundWork}` instead of a single promise:

- `result` contains the catalog counts (`added`, `updated`, `removed`, `total`) and is available immediately after the transaction completes.
- `backgroundWork` is a promise for the page count + thumbnail processing that runs asynchronously.

Callers respond to the user with the catalog result right away. The scan route sends the HTTP response immediately and clears the `scanning` flag when background work finishes. The startup log prints "Initial scan complete" within seconds, while page counts and thumbnails process in the background with progress logging.

Documents appear in the UI immediately after the catalog phase, with `page_count: 0` and placeholder thumbnails until background processing catches up.

## Summary of Impact

| Scenario                               | V1                            | V2                                   |
| -------------------------------------- | ----------------------------- | ------------------------------------ |
| Fresh scan (10k files), catalog phase  | ~5-10 min (hash all files)    | ~30s (stat only, no hashing)         |
| Fresh scan, total with post-processing | ~30 min (blocking)            | ~30s visible + background processing |
| Re-scan, nothing changed               | ~5-10 min (re-hash all files) | ~5s (mtime skip, no file I/O)        |
| Re-scan, 1 file changed                | ~5-10 min (re-hash all files) | ~5s catalog + hash 1 file            |
| Page count extraction (10k files)      | 1,000 sequential rounds of 10 | 200 sequential rounds of 50          |
| Thumbnail generation (10k files)       | Fully sequential              | Batches of 5 in parallel             |
| UI availability during scan            | Blocked until complete        | Available immediately after catalog  |
