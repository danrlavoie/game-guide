# Cookie Persistence Investigation (iPad Safari 10)

## Problem

Reading progress, favorites, and recently viewed documents are not persisting on iPad Safari. The same features work correctly on Firefox desktop. No server-side errors are logged when the iPad performs these actions.

## Architecture Context

The app identifies devices via a UUID stored in a cookie (`game_guide_device_id`). All per-device data (reading progress, favorites, settings) is keyed to this UUID. The flow:

1. Device middleware checks `req.cookies` for the UUID
2. If missing, generates a new UUID, sets it via `Set-Cookie`
3. Attaches `req.deviceId` to the request for downstream route handlers
4. Routes use `req.deviceId` to read/write per-device records in SQLite

If the cookie never persists, every request looks like a new device. Progress and favorites are saved against throwaway UUIDs that are never looked up again.

## Investigation Steps

### Step 1: Add Device Registration Logging

Added a log line in the device middleware that fires when a new device UUID is generated. This lets us see whether the cookie is being sent back on subsequent requests.

**Observation:** Every single request from iPad Safari generated a new UUID — even parallel requests within the same page load. The cookie was never being sent back.

```
{"component":"device","deviceId":"fe0c26a0-...","url":"/api/documents?recent=true&limit=5","msg":"New device registered"}
{"component":"device","deviceId":"d50e08d8-...","url":"/api/favorites","msg":"New device registered"}
{"component":"device","deviceId":"3f9575cf-...","url":"/api/documents?recent=true&limit=5","msg":"New device registered"}
```

### Step 2: Remove `sameSite` Cookie Attribute

**Hypothesis:** Safari 10 doesn't support the `SameSite` cookie attribute (introduced later). When it encounters an unrecognized attribute, it may reject the entire cookie.

**Fix (commit 0e12b69):** Removed `sameSite: 'lax'` from the cookie options. It was unnecessary anyway — `SameSite` protects against CSRF on cross-origin requests, but this is a same-origin LAN app.

**Result:** Did not fix the issue. New UUIDs were still generated on every request.

### Step 3: Add `credentials: 'same-origin'` to `fetch()`

**Hypothesis:** The `fetch()` API in Safari 10 defaults `credentials` to `'omit'` — the original Fetch spec default. This means cookies are never sent with requests and `Set-Cookie` response headers are ignored. Modern browsers changed this default to `'same-origin'`, which is why Firefox worked.

**Fix (commit 031beab):** Added `credentials: 'same-origin'` to all `fetch()` calls — both the shared `request()` helper and the standalone `fetch()` in `getTextContent`.

**Status:** Deployed, awaiting iPad verification.

## Root Cause Analysis

Two issues were stacked:

1. **`sameSite: 'lax'`** (server-side) — Safari 10 may reject cookies with unrecognized attributes. Removed as a precaution, though this alone didn't fix it.
2. **`credentials: 'omit'`** (client-side) — The real culprit. Safari 10's `fetch()` never sent or stored cookies without explicit `credentials: 'same-origin'`. This explains why every request appeared as a new device.

Firefox worked because modern browsers default `credentials` to `'same-origin'`.

## Verification Criteria

On the iPad after deployment:

- [ ] Server logs show "New device registered" **once** on first visit
- [ ] Subsequent page loads do NOT generate new device UUIDs
- [ ] Favoriting a document persists across page refreshes
- [ ] Reading progress is saved and restored when reopening a document
- [ ] Recently viewed documents appear on the home page

## Lessons Learned

1. **Safari 10 uses the original Fetch spec defaults.** The `credentials` default was changed from `'omit'` to `'same-origin'` in a later spec revision. Always set `credentials` explicitly when targeting older browsers.

2. **Cookie attributes can cause rejection, not just be ignored.** Newer attributes like `SameSite` may cause the entire cookie to be rejected on browsers that don't recognize them.

3. **Parallel requests are a good diagnostic signal.** When even two concurrent requests from the same page load generate different device IDs, the cookie is clearly not being stored at all — not a timing or expiration issue.

## Related Commits

| Commit    | Description                                                  |
| --------- | ------------------------------------------------------------ |
| `0e12b69` | Remove `sameSite` attribute, add device registration logging |
| `031beab` | Add `credentials: 'same-origin'` to all fetch calls          |
