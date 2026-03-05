# CBZ Thumbnail Extraction and Filename Encoding

## The Problem

Some CBZ archives fail thumbnail generation with errors like "filename not matched" or unexpected non-zero exit codes from `unzip`. This document explains why, and what the fix looks like.

## Background: How ZIP Stores Filenames

A ZIP archive stores each file's name as a byte sequence in its central directory. Crucially, the original ZIP specification (PKZIP, pre-2006) didn't mandate a character encoding — it just stored raw bytes. In practice, tools on different operating systems wrote filenames using whatever the system's default encoding happened to be:

- **Windows (Japanese locale):** Shift-JIS
- **Windows (Western):** CP437 or CP1252
- **macOS (modern):** UTF-8
- **Linux:** Usually UTF-8, but sometimes Latin-1

In 2006, the PKWARE APPNOTE added a "Language encoding flag" (bit 11 of the general purpose bit field) that, when set, indicates the filename is UTF-8. Modern tools like 7-Zip and macOS Archive Utility set this flag. But many archives in the wild — especially older ones, or those created by Japanese or Korean tools — don't set it and store filenames in a legacy encoding.

## What `unzip` Does

The Info-ZIP `unzip` utility (the standard one on most Linux distros) handles this situation poorly:

1. **Listing (`unzip -l`):** It reads the raw filename bytes and tries to display them. If the bytes aren't valid in the current locale (usually UTF-8), it may transliterate, substitute, or mangle characters. The _displayed_ filename is its best guess at rendering the bytes as text.

2. **Extraction (`unzip -o -j archive.zip "filename"`):** It compares the filename argument against the _raw bytes_ stored in the archive. If you pass the displayed/mangled version back, it won't match the raw bytes, and you get "filename not matched."

This is the core mismatch: `unzip -l` shows you one thing, but `unzip` expects the internal representation when extracting by name.

### Example

An archive created on a Japanese Windows system might store a filename as Shift-JIS bytes:

```
Raw bytes:   83 4B 83 43 83 68 2E 6A 70 67
Shift-JIS:   ガイド.jpg
unzip -l:    ³K³C³h.jpg    (garbled — interpreted as CP437/Latin-1)
```

Passing `³K³C³h.jpg` back to `unzip` for extraction fails because those aren't the actual bytes stored in the archive.

## The Unicode Warning Problem (Exit Code 1)

Even when filenames _are_ UTF-8, `unzip` can stumble on certain characters. If a filename contains characters like `™` (U+2122), `©`, or other non-ASCII Unicode, `unzip` may:

1. Successfully extract the file
2. Print a warning about the filename encoding
3. Exit with code **1** instead of 0

Exit code 1 for `unzip` means "completed with warnings." The file is on disk and perfectly fine, but Node's `child_process.exec` rejects the promise because the exit code is non-zero. The old code treated this as a hard failure.

## The Fix

The original approach was linear and optimistic:

```
1. Run `unzip -l` to list files
2. Parse output to find first image filename
3. Run `unzip -o -j archive.zip "first-image.jpg" -d tempdir`
4. Read tempdir/first-image.jpg into sharp
```

This breaks at step 3 for both problems described above. The new approach adds resilience:

```
1. Run `unzip -l` to list files          (same)
2. Parse output to find first image       (same)
3. Try extracting that specific file      (same)
4. ON ERROR:
   a. Check if a file actually extracted  (handles exit-code-1 warnings)
   b. If not, extract ALL files           (handles encoding mismatch)
5. Scan tempdir for first image file      (don't assume the filename)
```

The key insight in step 5 is: instead of constructing a path from the filename we parsed out of `unzip -l`, we just look at what's actually on disk. This sidesteps the entire encoding question. We don't need to know what encoding the archive uses — we just need the bytes to land on disk, and then we read whatever showed up.

### Why Extract All Files?

The fallback of extracting the entire archive (`unzip -o -j archive.zip -d tempdir`) works because `unzip` doesn't need to match a filename argument — it just extracts everything. The `-j` flag junks the directory structure, flattening all files into the temp directory. We then pick the first image alphabetically, generate the thumbnail, and delete the temp directory.

This is wasteful for large archives, but it only triggers as a fallback when the targeted extraction fails. For thumbnail generation (a one-time operation per document), the extra I/O is acceptable.

### Why Not Just Always Extract All?

Extracting all files from a large archive (some CBZ files are 500MB+) when we only need one image would be slow and disk-hungry. The targeted extraction is still the happy path — the fallback is there for the edge cases.

## Lessons

1. **Don't round-trip text through lossy transformations.** Parsing `unzip -l` output and feeding it back to `unzip` is a round-trip through the terminal's character encoding. The displayed text isn't necessarily what the tool expects as input.

2. **Non-zero exit codes don't always mean failure.** Many Unix tools use exit codes to signal warnings, partial success, or informational conditions. `unzip` exit code 1 means "success with warnings." Always check what a tool's exit codes actually mean before treating non-zero as an error.

3. **When in doubt, look at what's on disk.** Instead of predicting filenames through string manipulation, scan the directory for what actually appeared. The filesystem is the source of truth.
