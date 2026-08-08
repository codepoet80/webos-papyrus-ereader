# Papyrus - WebOS ePub Reader

## Project Overview

**Papyrus** (`com.palm.codepoet.papyrus`) is an open-source ePub reader for webOS, created by merging:
1. **Kindle Beta app** (`com.palm.app.kindle`) - Beautiful Enyo-based UI
2. **pReader app** (`com.mhwsoft.preader`) - Working pure-JavaScript ePub engine

The result is a fully functional e-reader for the HP TouchPad and other webOS devices, and also runs as a PWA on iOS Safari and modern desktop browsers.

---

## Current Status: COMMUNITY BETA

The app is fully functional and ready for community testing.

### Working Features
- Library grid/list view with book covers
- Smart file import: auto-detects filemgr service for reliable file scanning
- Multi-select file picker for batch ePub imports
- Import progress indicator ("Importing 1 of 5...")
- Loading spinner when opening books
- Page turns (tap left/right edges of screen)
- Optional volume button page turning (Settings > Volume buttons turn pages)
- Themes (white/sepia/black)
- Font controls (size and typeface)
- Reading position saved and restored
- Bookmarks via dog-ear button
- Table of Contents panel
- Search within book
- Dictionary look-up (Book menu > Define..., then tap a word)
- Discuss in Claude (optional, off by default): Book menu > Discuss in Claude... opens the current page for discussion (webOS: hands off to the Claude Chat app if installed; PWA/desktop: opens claude.ai). Enable via Preferences > Enable AI Features
- Settings persistence
- Optional page turn animation (fade effect)
- Auto-skip blank pages
- About dialog with app info
- WOSA Updater integration for update notifications
- PWA install support (iOS Safari, desktop browsers)
- ePub file import working on iOS Safari PWA

### Known Limitations
- Highlights/annotations UI not fully implemented
- Location slider not yet functional
- Some ePubs with unusual structure may not parse correctly
- Very large images may cause layout issues in some books
- **Phone/PWA layout at ~405px is broken** — see Section 11 below for what was tried and what was NOT resolved

---

## Directory Structure

```
/Users/jonwise/Projects/webos-ereader/
├── com.palm.codepoet.papyrus/              # ★ ACTIVE PROJECT
│   ├── app/                                 # Enyo UI components
│   │   ├── Main.js                          # App controller
│   │   ├── reading/
│   │   │   ├── body.js                      # Uses EpubRenderer
│   │   │   └── BookReader.js                # Touch handling, volume keys, loading spinner
│   │   ├── common/
│   │   │   ├── EpubRenderer.js              # ★ Core rendering engine
│   │   │   └── FileImporter.js              # ePub import handling
│   │   ├── contentContainer/                # Library views
│   │   ├── libraryNavigator/                # Sidebar navigation
│   │   └── panels/                          # Slideout panels (TOC, search)
│   ├── src/                                 # Preader engine (ported)
│   │   ├── pdb/EpubReader.js                # ePub parser
│   │   ├── display/PageFitter.js            # Pagination engine
│   │   ├── display/HTMLBook.js              # Book content storage
│   │   ├── MojoCompat.js                    # Mojo API compatibility shim
│   │   └── ...
│   └── appinfo.json
├── com.palm.app.kindle_0.12.50_all/         # Original Kindle (reference)
├── com.mhwsoft.preader_0.8.21_all/          # Original Preader (reference)
├── README.md                                # Public documentation
└── CLAUDE.md                                # This file (dev notes)
```

---

## Quick Start Commands

```bash
# Bump build number + package webOS .ipk (preferred)
cd /Users/jonwise/Projects/webos-papyrus-ereader
./build.sh

# Install and launch after packaging
palm-install com.palm.codepoet.papyrus_*.ipk && palm-launch com.palm.codepoet.papyrus

# View device logs (for debugging)
palm-log -f com.palm.codepoet.papyrus

# Manual package (skips build number bump)
palm-package app
```

`build.sh` increments the build number in `app/serviceworker.js` (CACHE_NAME) and `app/app/Main.js` (About dialog string) in lockstep, then runs `palm-package app`.

---

## Key Technical Details

### Page Turn Animation

Page turns use a subtle fade animation (80ms) that can be disabled:
- **Settings > Basic reading mode = ON**: Instant page changes
- **Settings > Basic reading mode = OFF**: Fade animation enabled

The animation respects the setting in real-time (no restart needed).

### Volume Button Page Turning

Hardware volume buttons can optionally be used to turn pages while reading:
- **Volume Up**: Next page
- **Volume Down**: Previous page

**To enable**: Settings > Volume buttons turn pages = ON

**Note**: This feature works best when the device audio is muted, otherwise volume change sounds will play.

This is implemented via the `palm://com.palm.keys/audio` service subscription in `BookReader.js`:
- Feature is disabled by default (controlled by `volumeKeyPageTurn` setting)
- Subscription starts when book is ready (`handlePluginReady`) if enabled
- Subscription stops when returning to library (`handleLibrarySelected`)
- Only responds to "down" events (ignores "up" events)
- Automatically hides overlays before turning page

### Blank Page Skipping

The renderer automatically skips blank pages when navigating forward:
- Maximum 5 consecutive blank pages skipped
- Only skips forward (backward navigation shows all pages)
- Blank = page with no visible text content after stripping HTML tags

### Loading Spinner

When opening a book, a loading spinner displays while:
- HTMLBook database is loaded
- PageFitter prepares the first page
- Spinner closes when `handlePluginReady()` fires

### Settings Storage

Settings are stored in `localStorage` under key `ereader_settings`:
```javascript
{
    basicReadingMode: false,    // Disable animations
    currentTheme: 0,            // 0=white, 1=sepia, 2=black
    currentFontType: 0,         // 0=Georgia, 1=Verdana
    currentFontSize: 18,        // 14, 18, 22, or 26
    currentContentView: "...",  // Grid or list view
    currentContentSort: "...",  // Sort order
    currentBook: {...},         // Last opened book
    currentAppView: "library",  // Current view
    volumeKeyPageTurn: false,   // Volume keys turn pages (webOS)
    keepScreenOnReading: false, // Prevent display sleep while reading
    enableAIFeatures: false,    // AI handoff features
    syncEnabled: false,         // Sync master switch
    syncMode: "webdav",         // "webdav" | "account" (webOS Account cloud storage)
    syncUrl: "",                // WebDAV mode only
    syncUser: "", syncPass: ""  // WebDAV creds — or account email/password in the PWA
}
```

**Important:** `Main.js` reads fresh settings before updating to avoid overwriting changes made by the Settings popup.

### Book Library Storage

Books are stored in `localStorage` under key `ereader_library` as a JSON array of BookData objects. Book content is stored in WebSQL databases (one per book).

### File Import / FileMgr Integration

The built-in webOS FilePicker only shows **indexed** files, which often misses newly-copied ePubs. To solve this:

**Automatic FileMgr Detection:**
1. On "Import ePub", app checks if `ca.canucksoftware.filemgr` is installed
2. If available, uses filemgr's `listFiles` service to scan directories directly (bypasses indexer)
3. If not available, triggers a media rescan (`com.palm.db/find`) and falls back to FilePicker

**FileMgr Integration** (if installed):
- Scans: `/media/internal`, `/media/internal/ebooks`, `/media/internal/books`, `/media/internal/Documents`, `/media/internal/downloads`
- Shows custom picker popup with all found `.epub` files
- Multi-select support with checkboxes
- Displays file sizes

**FilePicker Fallback** (if filemgr not installed):
- Triggers media rescan before showing picker
- FilePicker shows all documents (`fileType: ["document"]`)
- After selection, filters to only `.epub` files
- Non-epub selections show error: "Please select ePub files only"

**Service calls used:**
```javascript
// Check for filemgr
palm://com.palm.applicationManager/listApps

// Scan directories (filemgr)
palm://ca.canucksoftware.filemgr/listFiles {path: "/media/internal/ebooks", sort: "name"}

// Trigger media rescan (fallback)
palm://com.palm.db/find {query: {from: "com.palm.media.types:1"}}
```

Import supports multi-select - users can choose multiple ePubs and import them all at once with progress tracking.

### Share Page

"Share Page" appears in the Book menu (bottom toolbar, book-info popup). It sends the plain text of the current page as an email.

Platform dispatch in `BookReader.handleSharePage()`:
1. **webOS** (`window.PalmSystem`): launches `com.palm.app.email` via `palm://com.palm.applicationManager/launch` with `{summary, text}`
2. **PWA on iOS/Android** (`navigator.share`): invokes the native share sheet
3. **PWA on desktop / older browsers**: falls back to a `mailto:` URL (body truncated to 1800 chars)

Page text is extracted via `EpubRenderer.getPageText()` → `body.getPageText()` → `BookReader.handleSharePage()`.

### Furthest Read Position

`locationsCompleted` (stored in `localStorage` under `ereader_library`) is a **high-water mark** — it only ever advances forward. Jumping to a search result, TOC entry, or any other backward navigation does NOT update it.

**All three write sites are guarded:**
- `BookReader.saveReadingPosition()` — called when leaving the reader
- `Main.handleLocalPositionUpdated()` — fires on every page turn
- `Main.saveReadingPosition()` — called on app backgrounding

Guard pattern in each: `if (position > (current || 0)) { update }`.

The Bookmarks panel shows this value as "Furthest read position". It is also the position the book resumes from when reopened and the value synced to the configured sync backend.

### Cloud Sync Backends (`SyncManager.js`)

`settings.syncMode` selects one of two backends behind the same
`pushPosition`/`pullPosition`/`getSettings` interface — callers never branch:

- **`"webdav"`** (default): the original backend — per-book JSON files at
  `{syncUrl}/.papyrus/{syncKey}.json` with Basic auth. See fix #18 for its
  reliability quirks (423 Locked, status-0 retries, `Origin: null`).
- **`"account"`**: the webOS Archive app-storage service via
  `app/common/webos-app-storage.js` — a **vendored copy of
  `webos-common/AppStorage/webos-app-storage.js`; update it from there, don't
  edit it here.** Same payload, stored at key `book:{syncKey}` under app id
  `com.palm.codepoet.papyrus`. On webOS the device's webOS Account sign-in is
  adopted automatically over the Luna bus (`getAccountToken` — no password in
  the app); in the PWA the user signs in once from Settings (email/password →
  365-day token in localStorage). Values are scrambled client-side by the SDK
  before upload.

Account mode additionally syncs reader prefs (`SYNCED_SETTINGS` subset) at key
`"settings"`: pushed on Settings-popup OK (`pushSettings`), pulled and applied
at app startup (`Main.create` → `pullSettings`). Session state, AI toggles,
and sync credentials are never synced.

Server + protocol docs: `webos-catalog-service` CLAUDE.md (endpoints
`storage.php`, `device.php`); SDK API reference: `webos-common/AppStorage/README.md`.

---

## Architecture: Key Files

| File | Purpose |
|------|---------|
| `app/Main.js` | App controller, library management, settings, About dialog |
| `app/common/EpubRenderer.js` | Core rendering - wraps PageFitter with Enyo events |
| `app/common/FileImporter.js` | ePub import, parsing, library persistence |
| `app/reading/body.js` | Book view container, coordinates with EpubRenderer |
| `app/reading/BookReader.js` | Touch handling, toolbar, loading spinner |
| `app/reading/BookReader.css` | Reader styling, dogear positioning, z-index layering |
| `app/contentContainer/ContentNavigator.js` | Library grid/list view |
| `app/contentContainer/ItemMenuPopup.js` | Book long-press context menu |
| `app/userPreferences/Settings.js` | Settings popup |
| `app/userPreferences/UserSettings.css` | Settings and About dialog styling |
| `src/display/PageFitter.js` | Binary search pagination algorithm |
| `src/display/HTMLBook.js` | Chunked book storage with WebSQL |
| `src/pdb/EpubReader.js` | ePub parsing and validation |
| `src/MojoCompat.js` | Mojo API shim (Mojo.Controller, Mojo.Event, etc.) |

---

## Key Fixes Applied

### 1. UTF-8 Encoding
PageFitter encoding parameter must be `2` (UTF-8), not `0` (ASCII).

### 2. Location Scale
Uses fixed 0-10000 scale for `locationsTotal` instead of raw byte length.

### 3. Settings Persistence
`Main.js` reads fresh settings from localStorage before updating to avoid overwriting changes from Settings popup.

### 4. Enyo Popup Lazy Loading
Popups that need immediate access must have `lazy: false` to be available before first open.

### 5. FileMgr Integration for File Import
Built-in FilePicker misses non-indexed files. App now auto-detects `ca.canucksoftware.filemgr` and uses it to scan directories directly. Falls back to FilePicker with media rescan trigger if filemgr is not installed.

### 6. Dogear Button Z-Index
Dogear button needs `z-index: 110` to be clickable above the toolbar (`z-index: 105`).

### 7. About Dialog Styling
Remove Enyo's default `border-image` and set explicit `background-color` for proper rounded corners.

### 8. Mojo Compatibility
`src/MojoCompat.js` provides shims for Mojo APIs used by pReader code (Mojo.Controller.errorDialog, etc.).

### 9. SlidingPane Content Panel Width (PWA / Phone Layout)
Never use `width: calc(100% - 320px) !important` or any CSS `!important` override on `.content-panel`. Enyo manages panel widths via inline styles in `applySingleViewLayout` / `applyMultiViewLayout`, and CSS `!important` overrides break single-view (phone) layouts.

**Correct approach** — use `flex: 1` on the content panel definition, with no `width` or `fixedWidth: true`:
```javascript
{name: "contentPanel", peekWidth: 64, flex: 1, dragAnywhere: false, className: "content-panel", kind: "SlidingView", ...}
```
In multi-view mode (desktop), `HFlexLayout` + `flex-grow:1` naturally fills space after the 320px library panel. In single-view mode (phone), `applySingleViewLayout` overrides to `width: 100%`. Enyo also calls `calcFitWidth()` to correctly size the inner content area for both modes. No CSS width override needed.

Do not set a custom `multiViewMinWidth` — the default (500px) correctly puts phones in single-view and desktops in multi-view. Keep `selectContentView` condition as `window.innerWidth < window.innerHeight`.

### 10. SlidingPane Flexbox min-width (PWA / Modern Browser Multi-View)

In modern browsers, Enyo's `validateViewSizes()` sets the inner `$.client` div to `calcFitWidth()` = `paneWidth - offsetLeft - min(slidePos, 0)`. In the peek state this width (e.g. 1610px) exceeds the content panel's flex-allocated size. Modern CSS default `min-width: auto` on flex items then treats 1610px as the content panel's minimum, causing flexbox to shrink the library panel and physically relocate it — AFTER Enyo already computed layout from the correct `offsetLeft`. JavaScript state looks correct; visual layout breaks.

**Fix:**
```css
.library-panel { flex-shrink: 0; }   /* stays 320px; flex won't shrink it */
.content-panel { min-width: 0; }     /* inner div width doesn't set a flex floor */
```

Always apply these two rules whenever Enyo 1 SlidingPane panels live inside a modern flexbox container.

### 11. Phone Layout at ~405px — UNRESOLVED (do not re-attempt without fresh approach)

At browser widths ≤499px (single-view / phone mode), the layout breaks: library panel fills the screen and the content panel only shows a 64px sliver on the right. When the user slides the content panel into view it appears "covered by a copy of the left pane."

**What was tried (all in `ReaderPanel.js`):**
- `create()` calls `showPortraitView(true)` at narrow widths to pre-select content panel — in place.
- `resizeHandler()` override detects multiView flip and calls `showPortraitView`/`showLandscapeView` — in place, with diagnostic `enyo.log`.
- `isWideLayout()` helper for consistent width detection — in place.
- `handleWindowRotated` updated to use `isWideLayout()` (irrelevant in browsers; `sendOrientationChange` never fires because both `orientation` and `lastWindowOrientation` are always `undefined` in the browser, so the event is never dispatched).

**What was traced through Enyo source (enyo-build.js):**
- `SlidingPane.resizeHandler`: `this.getBounds().height && (this.resize(!0), this.inherited(arguments))` — skips everything if pane height is 0.
- `SlidingPane.resize()`: calls `setMultiView(window.innerWidth > 500)` then `validateViews()`. Does NOT re-select panels — only repositions based on the currently selected view.
- `applySingleViewLayout()`: zeroes `peekWidth` on all panels, sets `width:100%`, `fixedWidth:true`.
- `PeekingSlider.calcSlideAfter()`: returns `-contentPeek (-64)` in single-view, which gives 64px peek when library is selected.
- `validateViewPositions()` → cascades `validateSlide()` from first sibling, applying `translateX` based on `offsetLeft`. Library panel (index 0) is NEVER given a JS transform. Content panel gets `translateX(-offsetLeft)` when selected.
- `Pane._selectView()` calls `view.resized()` which triggers `broadcastMessage("resize")` → `resizeHandler()` on the view. This fires our override.

**Root cause not identified.** Static code analysis shows the logic should work, but the user consistently sees the library panel selected at 405px. The `resizeHandler` diagnostic log was added but console output was never obtained. Possible causes not ruled out:
- Service worker cache-first strategy serving stale `ReaderPanel.js` despite cache name bump.
- `SlidingPane.resizeHandler`'s height guard (`getBounds().height`) returning 0 at the time the handler fires, so `resize(!0)` is never called and `this.multiView` never changes.
- Something in the `Pane.transitionView` / `transitionDone` / `setShowing` sequence resetting the selected view after our logic runs.
- The "covered by copy of left pane" visual may simply be both panels having the same `library-background.png` — the content panel IS on top (DOM order) but its ContentNavigator shows an empty state that looks identical to the library background.

**Do NOT retry** by adjusting `showPortraitView` or `resizeHandler` calls — two sessions have been spent here with no result. A fresh approach would require: (a) obtaining the `enyo.log` console output to verify whether `resizeHandler` fires and whether `wasMultiView !== this.multiView`, and (b) using browser DevTools to inspect the actual DOM transforms and `this.view.name` at runtime.

### 12. iOS Safari File Import (`viewport-fit=cover` breaks the file picker)

**Problem:** Adding `viewport-fit=cover` to the viewport meta tag (done for safe-area insets on notched devices) caused iOS Safari to stop routing the native file picker result back to off-screen `<input type="file">` elements. The `change` event never fired, so imports silently failed.

**Root fix** (`index.html`): Removed `viewport-fit=cover`. The viewport meta reverts to `width=device-width, initial-scale=1.0`.

**Why the toolbar still clears the gesture area:** `BookReader.css` already uses `max(env(safe-area-inset-bottom), 20px)` for the toolbar bottom offset. Without `viewport-fit=cover`, `env()` returns 0 and the `20px` floor keeps the toolbar above the system gesture zone. No visual regression.

**Supporting changes (`webos-compat.js`):**
- Hidden file `<input>` uses `opacity:0` (not `display:none` or `visibility:hidden`) — iOS suppresses `change` on invisible inputs, but opacity:0 is safe.
- Simple `change` + `input` event listeners (no focus-poll fallback needed once `viewport-fit=cover` is removed).
- iOS overlay gets a stable DOM id (`papyrus-ios-picker-overlay`) and a global close handle (`window.__papyrusCloseIOSPickerOverlay`) so `Main.js` can dismiss it reliably.

**Supporting changes (`Main.js`):**
- `dismissIOSPickerOverlay()` helper: closes via the global handle AND via DOM id lookup as a belt-and-suspenders fallback.
- Called at the top of `handleFilePicked()` and `importMultipleEpubs()` so the overlay is always dismissed whether or not files were selected.
- Duck-typed File object check (`.name` is a string) instead of `instanceof Blob` — some iOS versions fail the realm check even for valid File objects.

### 13. ePub Metadata Parsing — Namespace and Multi-Title (`EpubReader.js`)

**Problem:** `getElementsByTagName("title")` is namespace-fragile. In OPF XML, the element is `<dc:title>` (qualified name `dc:title`, local name `title`). Strict XML parsers (some older Android WebViews) return nothing for a plain-name lookup. Additionally, ePubs for series books often have multiple `<dc:title>` elements — e.g. `<dc:title>Star Trek</dc:title>` (series) followed by `<dc:title>Star Trek Picard: 01 The Last Best Hope</dc:title>` (main). `[0]` always picked the series title.

**Fix:** Use `getElementsByTagNameNS(DC_NS, "title")` with fallbacks; prefer the element tagged `title-type="main"` via ePub3 `<meta refines>`, skip `"collection"` and `"subtitle"` types, fall back to longest remaining title. Same namespace-aware treatment applied to `dc:creator`, `dc:language`, and the new `dc:identifier` extraction.

**Scope:** Affects all platforms (confirmed broken on webOS, old Android, new Android — not iOS-specific).

### 14. ePub `dc:identifier` as Sync Key (`SyncManager.js`, `BookData.js`, `EpubReader.js`)

**Problem:** Sync keys derived from title+author slug were inconsistent across platforms because metadata quality varies: webOS OPF parser, old Android WebView, and new Chrome all produced different titles for the same book, giving different filenames on the WebDAV server.

**Fix:** Extract the ePub's `dc:identifier` (referenced by `<package unique-identifier="...">`) at import time and store it in `BookData.epubIdentifier`. `SyncManager.makeSyncKey(title, author, identifier)` uses the identifier as the primary key (e.g. `urn:isbn:9780062892058` → `isbn_9780062892058`); falls back to the old title+author slug when identifier is null. `pullPosition` retries with the legacy key on 404 for backward compatibility with existing sync files.

**Note:** Books imported before v1.3.0 have `epubIdentifier = null` and continue to use the title+author key. Re-importing a book on any device will populate the identifier going forward.

### 15. Service Worker Update Cycle — Self-Caching and HTTP Cache

Two failure modes that permanently lock clients to old code:

**SW self-caching (iOS Safari bug):** iOS routes the SW update check through the active SW's fetch handler. If `serviceworker.js` is in the SW cache, the old SW serves itself to the browser's update check and no update is ever detected.

**Fix in `serviceworker.js` fetch handler:**
```javascript
if (url.pathname.endsWith('/serviceworker.js')) return; // never cache self
```

**HTTP cache (all browsers):** Chrome/Firefox bypass the SW handler for update checks but still respect HTTP `Cache-Control`. If nginx serves `serviceworker.js` with any `max-age`, browsers cache it at the HTTP layer and the update check never reaches the server — even in incognito.

**Fix in nginx** (Papyrus server block):
```nginx
location = /serviceworker.js {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    add_header Pragma "no-cache";
    try_files $uri =404;
}
```

**Fix in `index.html`:**
```javascript
navigator.serviceWorker.register('serviceworker.js', { updateViaCache: 'none' })
```

**Deploy checklist:** Bump `CACHE_NAME` in `serviceworker.js` AND the build string in `Main.js` together on every deploy. The build string is the only visible proof of which version clients are actually running.

### 16. Reader Toolbar — Layout Shrink When Controls Appear (`BookReader.css`)

**Problem:** On Android Chrome (confirmed) and Safari (observed, fix pending), when the reader toolbar is shown the entire page content shrinks ~5%. Hiding the controls restores full size. The effect is a jarring reflow every time the user taps to show/hide the toolbar.

**Root cause:** `.bottom-row-controls` was missing `box-sizing: border-box`. Its 15px horizontal padding created overflow beyond the declared width, triggering the browser's "layout is wider than viewport" detection. The browser responded by shrinking the layout viewport to fit — the same mechanism that makes pages zoom out when content overflows on mobile.

**Fix already applied (`BookReader.css` line ~91, commit `60adc2c`):**
```css
.bottom-row-controls {
    box-sizing: border-box;   /* padding stays inside declared width; no overflow */
    ...
}
```

**Resize handler (`BookReader.js`):** The resize handler was also updated to ignore height-only changes (URL bar appearing/disappearing on mobile scroll) by comparing `window.innerWidth` on successive resize events — prevents spurious page reflows when the browser chrome toggles.

**Status:** Fix is in place for Android Chrome. Safari shows the same ~5% shrink — investigation deferred. Check whether any other element in the toolbar stack lacks `box-sizing: border-box` before looking elsewhere.

### 17. Popup Menus Disappearing Immediately on Chrome / iOS Safari (`enyo-build.js`, `BookReader.js`)

**Problem:** Reader toolbar overlays and FontBox popups appeared for a split second and then immediately dismissed on Chrome 56+ and iOS Safari 15.4+. The app menu was also broken (tapping it did nothing) when an earlier fix using `{passive: false}` was attempted.

**Root cause:** Two things interact:
1. Chrome 56+ and iOS Safari 15.4+ treat `document.ontouchstart = fn` as a passive listener, so `preventDefault()` inside `iphoneGesture.touchend` is silently ignored. The browser fires its own native (`isTrusted = true`) `mousedown` + `click` events *in addition to* Enyo's synthetic ones from the same touch.
2. `BasicPopup.mousedownHandler` sets `_didOpenMousedown = true` on every mousedown — including the duplicate native one. When the native `click` then fires, `processClick` closes the popup immediately.

**What was tried and reverted:** Setting `{passive: false}` on the `ontouchstart` listener in `iphoneGesture.connect()` suppressed all native click events, breaking the app menu's `addEventListener('click', ...)` handler entirely.

**Fix applied (`enyo-build.js`):**

*1. Stamp a timestamp on each synthetic event in `iphoneGesture.touchend`:*
```javascript
touchend: function(a) {
    this._lastSyntheticTime = Date.now();
    this._send("mouseup", a.changedTouches[0]);
    this._send("click", a.changedTouches[0]);
},
```

*2. In `BasicPopup.mousedownHandler`, skip `_didOpenMousedown` when the event is a native duplicate of a recent synthetic:*
```javascript
mousedownHandler: function(a, b) {
    var isDuplicate = b.isTrusted && enyo.iphoneGesture &&
        enyo.iphoneGesture._lastSyntheticTime &&
        (Date.now() - enyo.iphoneGesture._lastSyntheticTime < 500);
    if (!isDuplicate) this._didOpenMousedown = true;
    return this.modal && !b.dispatchTarget.isDescendantOf(this) && b.preventDefault(),
           this.fire("onmousedown", b);
},
```

*3. In `BookReader.handleMouseDown`, same isTrusted + timestamp guard prevents the toolbar overlay from toggling twice per tap:*
```javascript
handleMouseDown: function(inSender, inEvent) {
    if (inEvent && inEvent.isTrusted && typeof enyo !== 'undefined' &&
        enyo.iphoneGesture && enyo.iphoneGesture._lastSyntheticTime &&
        (Date.now() - enyo.iphoneGesture._lastSyntheticTime < 500)) {
        return;
    }
    // ... rest of handler ...
},
```

**Key insight:** `isTrusted === true` identifies native browser events; Enyo synthetic events are plain objects with `isTrusted === undefined`. The 500ms window handles any realistic tap duration.

### 18. WebDAV Sync Reliability — 423 Locked and Status-0 Retries (`SyncManager.js`, `Main.js`)

**Problem 1 — HTTP 423 Locked:** WebDAV PUT returned 423 when the ownCloud desktop client held a lock on the sync file or directory. The error surfaced as a generic "Sync error (HTTP 423)" with no guidance. Worse, the lock persists even after deleting the sync file because ownCloud stores locks in its database, not in the file.

**Fix:** `pushPosition` now uses an inner `handlePutStatus(status, isRetry)` handler. On 423 (and not already a retry), it waits 3 seconds and retries once — enough time for a transient desktop-client lock to clear. If the retry also fails it reports the error. `Main.js` shows a specific message: *"Sync file is locked by another app. Wait a moment and try again."*

**Problem 2 — Status 0 on first Sync Now for a never-synced book:** The first manual sync on a brand-new book failed with "Cannot reach sync server" but succeeded on the second tap. `pullPosition` already had a 2-second status-0 retry (for cold TLS handshakes on webOS), but `pushPosition` gave up immediately on status 0. The CORS OPTIONS preflight for the PUT can fail on first connection, returning status 0 to JS.

**Fix:** `pushPosition` now also retries on status 0 (same 2-second delay, same once-only guard via `isRetry`). Both 423 and status-0 retries share the `isRetry` flag so at most one retry ever fires regardless of which condition triggers first.

**Error messages added to `Main.js` `syncNow`:**
```javascript
var errMsg = pushStatus === 0   ? "Could not reach sync server." :
             pushStatus === 423 ? "Sync file is locked by another app.\nWait a moment and try again." :
                                  "Sync error (HTTP " + pushStatus + ").";
```

### 19. Import Pipeline — Performance Sensitivity and Protected Invariants

**Do not change `EpubReader.js` or `HTMLBook.js` without a before/after import timing test on a real webOS TouchPad.**

The import pipeline is fragile in ways that are not obvious from static code analysis:

**EpubReader.js affects both display AND import.** Any change to how EpubReader loads or processes images will affect the import path, not just the book-open path. A change made to improve cover image display silently made Cognition in the Wild (40+ images, 83 text chunks) balloon from 3 minutes to 10+ minutes on device. The root cause was never fully isolated before the change was reverted.

**HTMLBook.js `tagWorker` defer() calls are expensive on old WebKit.** Each `Function.prototype.defer()` call on webOS TouchPad JavaScriptCore (~1GHz ARM) costs ~35ms of real time. The tagWorker already yields once per img tag — that is intentional and sufficient. Do NOT add additional defer() calls inside the img processing path for normal-sized images.

**Synchronous `btoa()` is fast for small images.** On old WebKit, `btoa()` is O(n²) on very large strings (hundreds of KB to MB), but for images under ~100KB it completes in milliseconds. Replacing synchronous btoa with async chunked encoding (one defer per 3KB chunk) makes small image encoding 5–10× slower because the per-defer overhead exceeds the btoa time. Only use async chunked encoding for images above a size threshold (e.g. 200KB+).

**Canary test for import performance:** Import "Cognition in the Wild" (a heavily illustrated cognitive science textbook, ~83 text chunks, 40+ GIF images). On a webOS TouchPad at commit `656db0e`, this completes in approximately 3 minutes. Any regression beyond 5 minutes indicates a problem in the import pipeline.

**The `asyncHandled` pattern was tried and reverted.** A session attempted to fix a btoa hang on a large cover image (Star Trek Picard, 1.44MB decompressed) by making all image encoding async-chunked. This was reverted because it made typical imports 3× slower. If the large-image btoa hang is revisited, the fix must be gated by image size — not applied universally.

**The correct fix for oversized images is a skip guard — see fix #26.**

### 20. `<font>` Tag Override — Font Controls Ignored by Old ePubs (`common.css`)

**Problem:** ePubs produced by early Sigil, calibre, and PDF-to-ePub converters use deprecated HTML `<font face="..." size="...">` tags for all text. The `face` and `size` attributes act as element-level style declarations and override CSS inheritance from the container. `EpubRenderer.applyFont()` sets `font-family` and `font-size` as inline styles on `.epub-page-container`, but `<font>` elements inside the container ignore those inherited values entirely. Result: the user's font face and font size controls have no visible effect on the text. As a secondary symptom, `<br/>` tags (which use the *container's* line-height) did respond to font size changes, so increasing size only made paragraph spacing larger without making text bigger.

**Fix (`common.css`):** CSS rules scoped to `.epub-page-container` and `.epub-offscreen` force `<font>` elements to inherit font-family with `!important`. The seven HTML `size` attribute values (1–7) are mapped to proportional `em` units so the book's relative size hierarchy (headings vs. body vs. captions) is preserved while everything scales with the user's chosen base size:

```css
.epub-page-container font,
.epub-offscreen font { font-family: inherit !important; }

.epub-page-container font[size="1"], .epub-offscreen font[size="1"] { font-size: 0.67em !important; }
.epub-page-container font[size="2"], .epub-offscreen font[size="2"] { font-size: 0.83em !important; }
.epub-page-container font[size="3"], .epub-offscreen font[size="3"] { font-size: 1em   !important; }
.epub-page-container font[size="4"], .epub-offscreen font[size="4"] { font-size: 1.17em !important; }
/* ... 5/6/7 similarly ... */
```

Rules are applied to **both** `.epub-page-container` and `.epub-offscreen` so the PageFitter binary search measures content at the same size that is displayed — keeping pagination consistent. No re-import required; this is a render-time CSS change. Modern ePubs that use proper CSS (not `<font>` tags) are completely unaffected.

### 21. Excessive `<br/>` Spacing from Table-Based Old ePub Layout (`common.css`, `EpubReader.js`)

**Problem:** ePubs converted from PDFs or HTML using table-based layout (common 2007–2012 era, e.g. "Cognition in the Wild") wrap each paragraph in a 5-row `<table>`. `EpubReader` converts `<table>` and each `<tr>` opening to `<br/>`, so a single paragraph structure produces 6 consecutive `<br/>` tags, and the gap between two adjacent paragraphs becomes 12. At 18px text with 1.6 line-height (~29px/break), 12 breaks consume ~350px — easily a third of a page — purely as whitespace.

**Fix (`common.css`):** CSS adjacent-sibling selector hides the 3rd `<br/>` onward in any consecutive run:

```css
.epub-page-container br + br + br,
.epub-offscreen br + br + br { display: none; }
```

**Critical constraint — why `</p>` must emit a chain-breaker span (`EpubReader.js`):**

CSS `br + br + br` counts adjacent sibling **elements**, ignoring text nodes. Without a chain-breaker, every `<br/>` in a chapter (across all paragraphs) forms one continuous sibling chain. For a modern ePub that uses only `<p>` tags (each converted to `<br/>\t` open + `<br/>` close), a chapter of n paragraphs produces 2n consecutive `<br/>` siblings. The 3rd `<br/>` (the opening of the 2nd paragraph) gets hidden — collapsing all paragraphs past the first onto one line.

**Fix:** `EpubReader.js` emits `<span class="pb"></span><br/>` for `</p>` instead of just `<br/>`. The empty span is an element sibling that resets the CSS chain at every paragraph boundary. For normal books, runs never reach 3 consecutive `<br/>`; for old table-layout books, the table/tr-generated `<br/>` still form 3+ runs between paragraphs and get correctly suppressed.

**Re-import required:** Books already imported before this fix have the old HTML structure (no span chain-breakers). For already-imported modern ePubs where bold/italic/line-breaks appear broken, delete and re-import the book. Old table-layout books already in the library continue to work with the CSS rule alone.

### 22. Pop-Balloon Popup White Rectangle on webOS (`BookReader.css`, `BookReader.js`)

**Problem:** On webOS, all popup menus (Book menu, Font, Brightness) showed a white rectangle behind their rounded balloon borders when the reader was in sepia or black theme.

**Two root causes:**

1. `.pop-balloon.enyo-popup` had `border-image: none` to suppress the Enyo Onyx popup background, but webOS old WebKit only understands `-webkit-border-image`. The Onyx `popup.png` (white/grey rounded rectangle) was still rendering behind the balloon image. **Fix:** added `-webkit-border-image: none` to `.pop-balloon.enyo-popup`.

2. `BookReader.updateThemeClass()` called `this.$.body.changeCSSClassesTo()` but never `this.$.bottom_row.changeCSSClassesTo()` or `this.$.top_row.changeCSSClassesTo()`. The Book menu, font, and brightness popups kept their initial `white` class permanently regardless of theme. **Fix:** both calls added to `updateThemeClass`.

### 23. Search Feature — Event Re-entrancy (`Main.js`)

**Problem:** Tapping the magnifying glass, typing, and pressing Enter did nothing. The search query event from the toolbar reached `top_row` (logged) but produced no visible result.

**Root cause:** `Main.handleSearchQueried` called `sv.doSearch()`, which internally fires `onSearchQueried` back up through `SlideoutPanel` → `Main.handleSearchQueried` → `sv.doSearch()` → infinite synchronous recursion. webOS JavaScriptCore stack-overflowed before any DOM update was flushed, so the panel never opened.

**Fix:** `_searchInProgress` flag (wrapped in try/finally) in `Main.handleSearchQueried` detects the re-entrant call from `SearchView.doSearch()` and returns immediately, breaking the cycle. The underlying `SearchView.doSearch()` then completes normally and calls `EpubRenderer.searchBook()`.

### 24. Furthest Read Position — High-Water Mark (`BookReader.js`, `Main.js`)

**Problem:** Jumping to a search result (or any backward navigation) updated `locationsCompleted` to the earlier position, overwriting the user's actual reading progress. The Bookmarks panel showed the search result location as "Last read position".

**Fix:** All three write sites for `locationsCompleted` now guard with `if (newPos > prev) { update }`:
- `BookReader.saveReadingPosition()`
- `Main.handleLocalPositionUpdated()` — fires on every page turn (in-memory only at the time; see #25, which made it also write `localStorage`)
- `Main.saveReadingPosition()` — called on app backgrounding

Label in the Bookmarks panel updated from "Last read position" to "Furthest read position".

### 25. Reading Position Lost on Swipe-Away — Save Guard Defeated by In-Memory High-Water (`Main.js`, `BookReader.js`)

**Problem:** Read a book from 75% to 85%, swipe the app card away (so sync does not fire or fails for lack of connectivity), reopen — the book shows 85% for a moment and then snaps back to 75%. Felt like sync was overwriting the position, but the sync-pull guard (`remote.position > localPos`) was actually correct. The position was never durably saved in the first place.

**Root cause:** The furthest-read position was only ever written to `localStorage` by `saveReadingPosition()`, which runs on clean exit / window deactivate. But:
1. `Main.handleLocalPositionUpdated()` advances `this.currentBook.locationsCompleted` **in memory on every page turn** — no `localStorage` write.
2. `saveReadingPosition()` then guards with `if (position > this.currentBook.locationsCompleted)`. Because step 1 already set `locationsCompleted` equal to the current page, the guard is **always false**, so it never wrote to `localStorage` and never pushed to the server.

So the new position lived only in the killed process's memory. `localStorage` and the server both kept the old value. Network sync was the *only* path that ever persisted progress; when it failed, the read position was lost. (This also reveals fix #24's description was wrong: `handleLocalPositionUpdated` was an in-memory-only path, not a `localStorage` write path.)

**Fix:**
- `Main.handleLocalPositionUpdated()` now calls `updateBookInLibrary()` on every forward advance, persisting the high-water mark to `localStorage` per page turn — durable regardless of connectivity or whether an exit handler ever fires. Still guarded by `>` so backward navigation never lowers it.
- `Main.saveReadingPosition()` decoupled the server push from the local-write guard: it now always pushes the current high-water mark on exit/deactivate, even when `locationsCompleted` was already advanced in memory.
- `BookReader.syncPullPosition()` (auto-pull on open) now pushes the local position **up** to the server when local is ahead of remote (the stale-server case), instead of doing nothing.
- `Main.maybeBackgroundSync()` adds a throttled in-session server push so a mid-reading kill does not strand the server at a stale position. Fires at most once per `SYNC_PUSH_EVERY_N_TURNS` (5) forward page turns AND no more often than `SYNC_PUSH_MIN_INTERVAL_MS` (30s) apart — the time floor keeps rapid page-flipping (searching for something) from hammering the WebDAV server or tripping ownCloud 423 locks (fix #18). Local persistence is still every page turn; only the network push is throttled.

**Push triggers (server), full set:** book open (push-up if local ahead), every 5 page turns / 30s while reading (`maybeBackgroundSync`), leaving reader, window deactivate/blur, manual Sync Now. **Pull:** book open only.

**Deploy note:** This is JS-only. Bump `CACHE_NAME`/build string and redeploy; verify clients aren't served a stale `serviceworker.js` (see fix #15).

**Tunables:** `SYNC_PUSH_EVERY_N_TURNS` (5) and `SYNC_PUSH_MIN_INTERVAL_MS` (30000) are class fields on `ereader.Main` in `Main.js`, right above `maybeBackgroundSync()`.

**Status / resume here (as of build v92, ipk `com.palm.codepoet.papyrus_1.3.4_all.ipk`):**
- Code complete and packaged. Build bumped v91 → v92. **NOT yet verified on a real device** — this was the stopping point.
- **Verify the original repro:** open a book ~75%, read to ~85%, swipe the app card away (no clean exit, or with no connectivity), reopen. Expected: stays at 85% (was snapping back to 75%). The local `localStorage` write per page turn is what makes this hold even when sync fails.
- **Verify background push throttle:** with sync enabled and reachable, watch `palm-log -f com.palm.codepoet.papyrus` for `Sync: background push at position=` lines — should appear ~every 5 pages while reading and be suppressed during rapid page-flipping (the 30s floor).
- **Watch for stale SW:** confirm About dialog shows `(build v92)` on the test device; if it shows v91 the device is running cached code, not this fix (see #15).
- **Open follow-up (not done, optional):** background push and the exit/deactivate push can both fire within ~30s of each other (harmless idempotent PUTs; SyncManager has 423 retry). If desired, have `Main.saveReadingPosition()` stamp `this._lastBgPushTime = Date.now()` after it pushes so the throttle counts pushes of any kind. Skipped to avoid cross-method coupling.

---

### 26. Oversized Image Skip — Hour-Long Import on ePubs with Large Covers (`HTMLBook.js`, `EpubReader.js`)

**Problem:** `HTMLBook.tagWorker` called `bytesToBase64(bytes)` synchronously when it encountered any `<img label>` tag, with no size guard. For ePubs with a cover image over ~1MB (e.g. Star Trek Available Light, 2.4MB JPEG), this triggered the O(n²) `btoa()` path on webOS old WebKit and caused the import to hang for over an hour. `EpubReader.getCoverImage()` already had a 1.5MB guard for the library thumbnail, but the rendering/storage path in `tagWorker` had none.

**Two-part fix:**

*1. `HTMLBook.tagWorker` (`src/display/HTMLBook.js`)* — after the `bytes == null` check, skip images above 1MB on webOS: push the label into `imgNameBuffer` (so it is never retried), set `breakForWebOS = false`, and `break`. The image is not stored in WebSQL; it will appear blank when reading on webOS, which is acceptable.

*2. `EpubReader.getDataContent` (`src/pdb/EpubReader.js`)* — before calling `uncompressAsync`, check `zipped.file.uSize > 1048576` and skip decompression on webOS (calls `loadWorker` with `null` data immediately). Saves ~1–2 seconds of DEFLATE work on top of the btoa fix. Both guards use `typeof window !== 'undefined' && window.PalmSystem` for webOS detection.

**Threshold:** 1MB (1,048,576 bytes) on webOS; no limit on other platforms. Matches the spirit of `getCoverImage()`'s 1.5MB guard. Images under 1MB (the vast majority of in-chapter images) are unaffected.

**Effect on cover thumbnail:** Covers above 1.5MB are already skipped by `getCoverImage()` (existing guard) and will show no thumbnail in the library on webOS. The cover page in the book also shows blank on webOS when the cover image exceeds 1MB. Both show normally on PWA/desktop (fast btoa, no limit).

**Font files:** Font TTFs in the manifest are already excluded from import — they don't pass the `entry.type.startsWith("image/")` check in `getDataContent` and are never loaded or btoa-encoded. No action needed for fonts.

### 27. Enyo Package Size — Unused Locale Data Removed

The `.ipk` grew to ~7MB partly because `enyo/build/g11n/` contained 2.7MB of locale data files, most for features the app never uses.

**What was deleted (safe to remove — zero references in app code):**
- `enyo/build/g11n/phone/` — 1.9MB, country phone-number format data
- `enyo/build/g11n/address/` — 116K, address format data
- `enyo/build/g11n/name/` — 92K, name format data
- `enyo/build/g11n/css/` — 8K, unreferenced
- `images/test-pages.png` and `images/test-pages-2.png` — 528K combined, Kindle test assets

**What was kept:** `enyo/build/g11n/base/` (600K) — all four subdirs (`formats/`, `datetime_data/`, `character_data/`, `number_data/`) are loaded at runtime via synchronous XHR by `enyo.g11n.DateFmt` (list-view "Opened" dates) and `enyo.g11n.NumberFmt` (location percentage). Removing `base/` would cause those formatters to silently return `undefined`.

**`enyo/lib/`** (2.4MB: telephony, authlib, contacts, print, wifi) is also unused but was NOT removed in this pass — it is separate from `enyo/build/` and warrants a dedicated verification pass before deletion.

### 28. Dictionary Look-up (Define mode) — Word Hit-Testing and webOS Font Caveats

Tap a word in the reader to look up its definition. Entered from a **"Define..."** item in the book menu (`BookInfoPopup.js`); the next page tap resolves to a word, is looked up against dictionaryapi.dev, and is shown in a themed centered card. Mode auto-exits after one lookup (even on failure) or can be toggled off from the menu.

**Files:** `app/common/Dictionary.js` (new — `PapyrusDictionary.lookup`), `app/reading/DefinitionPopup.js`/`.css` (new — the card), plus `EpubRenderer.js` (word hit-test), `body.js` (pass-throughs), `BookInfoPopup.js` + `bottom_row.js` (menu item + checkmark), `BookReader.js` (Define-mode state + tap intercept), `common.css` (highlight), `depends.js`.

**Word hit-testing is geometric, NOT `caretRangeFromPoint` (`EpubRenderer.getWordAt`).** The caret API was tried first (both `caretRangeFromPoint` and a `Selection.modify` word-snap) and returned nothing usable on the target platform — every tap resolved outside the page container, almost certainly because an overlay intercepts the caret hit-test. The working implementation (`_charAt`) walks the page container's own text nodes via a `TreeWalker` and uses per-character `Range.getBoundingClientRect()` to find the glyph under the tap (nearest glyph on the line if the tap lands in a gap), then `_expandWord` grows to word boundaries. Because it only ever inspects text INSIDE `.epub-page-container`, no overlay can throw it off, and it behaves identically on webOS old WebKit and modern browsers. **Do not "simplify" this back to `caretRangeFromPoint`.** `getLastWordFailReason()` surfaces a short reason (shown in the banner) for diagnosing misses without device logs.

**Tapped-word highlight:** the word's range is wrapped in a `.define-highlight` span (translucent yellow, `common.css`) while the definition shows; cleared on popup close (`onClosed` → `body.clearWordHighlight`) and dropped automatically when a page turn re-renders `innerHTML`.

**webOS font caveats (all confirmed as tofu / placeholder boxes on the TouchPad):**
- **IPA phonetic is suppressed on webOS** (`DefinitionPopup._pickPhonetic` returns `""` when `window.PalmSystem`). The old font set has no IPA coverage. Still shown on PWA/desktop.
- **Menu checkmark uses webOS's own asset**, not a glyph. `U+2713` renders as a box, so `BookInfoItem.setChecked` toggles a `.bookinfo-checked` class whose background is `enyo/build/palm/themes/Onyx/images/checkmark.png` (the blue system-menu check, visible on all three menu themes; relative path from `BookReader.css` is `../../enyo/build/...`). An earlier "(on)" text suffix was rejected as ugly.
- **Example quotes use straight `"`**, not curly, for the same reason.

**Network:** `Dictionary.js` reuses the `SyncManager` XHR idiom — `Origin: null` header (webOS `file://`) and a one-time status-0 retry — for old-WebKit compatibility. No `fetch`/Promises. Fails gracefully to "No definition found" (404) / "Couldn't reach the dictionary" (status 0).

**Chrome stays visible in Define mode** (`BookReader.handleDefineModeToggle`). In Define mode every page tap is a word look-up, so hiding the toolbars would make the book menu — the only manual way to toggle the mode off — unreachable. Do not hide overlays on entering Define mode.

### 29. Discuss in Claude — Optional Hand-off to the Claude Chat App

Hands the current reading passage to the separate **Claude Chat** webOS app (`org.webosarchive.claudechat`, at `~/Projects/enyo2-claudechat`) so the user can discuss the book with Claude. Opt-in and gated, because some users don't want AI.

**Gating (per platform, in `BookReader.updateClaudeMenuAvailability()`):**
1. **Setting on** — `enableAIFeatures` in `ereader_settings`, **default OFF**, toggled in Preferences (`Settings.js`, "Enable AI Features" — a shared gate for any future AI features, not Claude-specific). Required on all platforms.
2. **webOS** (`window.PalmSystem`): additionally requires **Claude Chat installed** — `detectClaudeApp()` calls `palm://com.palm.applicationManager/listApps` and sets `this.claudeInstalled` when it finds `org.webosarchive.claudechat` (`handleClaudeListApps`). Hand-off is app-to-app (see launch contract below).
3. **PWA / browser** (no `PalmSystem`): setting-on is enough — there is no local app, so it opens the public **claude.ai** site instead (see web path below). No install check.

`updateClaudeMenuAvailability()` calls `bottom_row.setClaudeAvailability()` → `BookInfoPopup.setClaudeAvailability()` → `this.$.claude.setShowing()`. Called on every `showOverlays()` so toggling the setting mid-session takes effect without reopening the book, and again when `listApps` resolves. The `claude` `BookInfoItem` ships `showing: false`.

**Platform dispatch (`BookReader.launchClaudeChat`):** `window.PalmSystem` → `launchClaudeApp` (app hand-off); else → `openClaudeWeb`.

**Menu wiring** mirrors "Share Page": `BookInfoPopup` item `claude` → `bottom_row` `onDiscussInClaude` → `BookReader.handleDiscussInClaude`.

**Passage extraction — previous + current + next page (`EpubRenderer.getAdjacentPagesText`).** Current page is the live `getPageText()`. Adjacent pages are computed on **`preloaderFitter`** (the existing background PageFitter — never the user's `pageFitter`, so no visible page turn) synced to the current position, rendered into the hidden `preloadOffscreen` node purely to read `innerText`. Async (fitter binary search is callback-based). Cancels any in-flight preload first (`preloadToken++`); a later page turn reschedules preloading normally. Returns `""` for prev/next at book boundaries.

**Launch contract.** `BookReader.launchClaudeChat()` calls `palm://com.palm.applicationManager/launch` with:
```javascript
{ id: "org.webosarchive.claudechat",
  params: { mode: "bookchat", query: "",
            title: encodeURIComponent(title), author: encodeURIComponent(author),
            context: encodeURIComponent(prevCurNextText) } }
```
Values are URI-encoded so the receiver's `decodeURIComponent` round-trips them (matches Claude Chat's JustType `query` convention). `context` is capped at `CLAUDE_CONTEXT_MAX` (7000 chars) to stay under webOS launch-param size limits.

**Web path (`BookReader.openClaudeWeb`, PWA / browser only).** No local app and no hidden-context channel, so the framing + passage are folded into one prompt and opened at `https://claude.ai/new?q=<encoded prompt>` via `window.open(url, "_blank")` (falls back to `location.href`). The passage is trimmed in a loop (~12%/pass) until the **fully-encoded URL** is under `CLAUDE_WEB_URL_MAX` (2000 chars) — NOT a raw-character cap: `encodeURIComponent` inflates text unpredictably (spaces/newlines → `%XX`), so only the encoded URL length actually bounds what the server sees, and an over-long URL risks a 414. The loop converges in a handful of passes (input is already ≤`CLAUDE_CONTEXT_MAX`). **Priority:** only the passage (`ctx`) is trimmed — the fixed `prefix` (title, author, framing) and `suffix` are never cut, so the model always gets book identity + intent and fits in as much passage as the URL budget allows. This assumes the modern web is reachable (true in PWA/desktop, never on webOS).

**Receiver side (Claude Chat repo, separate app):**
- `source/app.js` `_jtOnLaunchParams` branches on `lp.mode === "bookchat"` (distinct from a JustType search) and routes `{context, title, author}` to `App._appView.handleBookChat` (with a `_pendingBookChat` stash drained in `RootView.rendered`, same pattern as `_pendingQuery`).
- `source/views/views.js` `ChatView.handleBookChat` starts a fresh conversation, stores the passage in-memory as `_bookContext` (NOT persisted; cleared by `newChat()` and `handleJustTypeQuery()`), adds a **persisted** "Let's talk about …" intro as a real assistant message (so it survives refreshes — e.g. after visiting History — and becomes the conversation's history preview), and — unlike JustType — does **not** auto-send; the user types their own question. `Conversation.getApiMessages()` strips leading non-user messages, so that intro (a leading assistant turn) is never sent to the API. No emoji/curly quotes in visible webOS text (tofu on the old font — see #28).
- `_dispatch` layers the passage onto the system prompt via `_composeBookSystemPrompt(base, bc)` for that conversation only (the user's saved system prompt is untouched). The context rides in the **system prompt**, not as a visible transcript message, so it stays hidden but in scope for the whole discussion.
- No `appinfo.json` change: a direct `applicationManager/launch` delivers `params` to `PalmSystem.launchParams` regardless of the `universalSearch` registration.
- Caveat: Claude Chat silently routes to Settings if no API key is configured; the book context stays in memory so it still applies once a key is set.

**Deploy:** JS-only on both apps. Bump each app's build/cache string and redeploy (Papyrus: `build.sh`; watch for stale service-worker cache per fix #15).

**Status / resume here (end of 2026-07-24):**
- Code complete on **both** apps; all files pass `node --check`. Changes are **uncommitted** in both working trees (Papyrus `webos-papyrus-ereader` and Claude Chat `~/Projects/enyo2-claudechat`) — nothing committed yet.
- PWA was redeployed and confirmed loading (an "App init failed: … DefinitionPopup" error during testing was just a stale service-worker cache — resolved by a hard refresh, not a code bug; see fix #15).
- App icons were replaced from `app/icon-256.png` (all `app/icons/*` + `app/icon.png`); `icons/512.png` is a 2× upscale (soft) and `meta/1005822/icon-256.png` (store copy) was intentionally left on the OLD design.
- **Not yet verified — the point of the pending real-world tests:**
  1. **webOS app-to-app hand-off** — book menu → "Discuss in Claude…" launches `org.webosarchive.claudechat` with the `mode:"bookchat"` params and Claude answers with passage context. (`.ipk` builds via `build.sh` but device install/verify pending.)
  2. **PWA/desktop web path** — opens `claude.ai/new?q=…`. **Biggest unknown:** whether the `q=` prefill survives claude.ai's login redirect for a logged-out user. If it doesn't, revisit `openClaudeWeb`.
  3. **Adjacent-page extraction** (`getAdjacentPagesText`) returns sensible prev/next text on real books (esp. at chapter/file boundaries and book start/end).
  4. **Gating** — item hidden when "Enable AI Features" is off; on webOS also hidden when Claude Chat not installed; visible on PWA with the setting on.
  5. **History preview** shows the intro/cue line, and the cue persists after visiting History (Claude Chat side).

### 30. Account Sync Stuck After Switching webOS Accounts on Device (`SyncManager.js`)

**Problem:** Switching the device's signed-in webOS Account (sign out of account A, sign into account B) permanently broke `syncMode: "account"` sync with "Failed: Invalid or expired account token" — Sync Now, background push, and pull all failed, and there was no way to recover short of clearing app data.

**Root cause:** `WebOSAppStorage.isSignedIn()` (`webos-app-storage.js`) only checks "is *some* token cached in `localStorage`" — it never re-verifies that token still matches the account currently signed into the device. `SyncManager._ensureAccountAuth()` used that as a short-circuit: once any token was cached, `useDeviceAccount()` (the Luna-bus call that adopts the device's *current* account) was never called again. Meanwhile `org.webosarchive.webosaccount`'s `SignOutCommandAssistant` calls `device.php?m=deauthenticate` on sign-out, which **revokes that token server-side**. So the cached token wasn't just stale — the server had actively killed it, and nothing in Papyrus ever noticed or recovered.

**Fix:** `_ensureAccountAuth(callback, forceRefresh)` gained a `forceRefresh` param that bypasses the `isSignedIn()` cache and re-adopts the device's current account. All five account-mode entry points (`_accountPush`, `_accountPull`, `testAccount`, `pushSettings`, `pullSettings`) now detect `err.status === 401` from the storage call, call `_ensureAccountAuth(cb, true)` once, and retry the operation — self-healing after an account switch with no user action needed. Guarded by a single `isRetry` flag per call so a genuinely-dead account (no webOS Account signed in at all) still fails cleanly instead of looping.

**Note:** A device already stuck in this state before the fix needs the fixed `SyncManager.js` delivered (reinstall, or a live novacom `put` for dev-loop testing) — the retry logic can't help until the code that contains it is actually running.

---

## Implementation Status

### Completed
- [x] ePub parsing and rendering
- [x] Page navigation (tap zones)
- [x] Font size and typeface controls
- [x] Theme switching (white/sepia/black)
- [x] Reading position persistence
- [x] Table of Contents panel
- [x] Search within book
- [x] Cover image extraction
- [x] Multi-select file import with progress
- [x] Optional page turn animation
- [x] Blank page auto-skip
- [x] Settings persistence fix
- [x] Loading spinner for book opening
- [x] About dialog
- [x] Dogear bookmark button
- [x] FileMgr integration for reliable file import
- [x] iOS Safari file import (viewport-fit fix + overlay cleanup)
- [x] PWA install support
- [x] ePub `dc:identifier`-based sync key (cross-platform consistent)
- [x] Namespace-aware ePub metadata parsing (multi-title disambiguation)
- [x] Service worker self-caching fix (iOS) + HTTP cache fix (all browsers)
- [x] Popup menus stay open on Chrome / iOS Safari (isTrusted duplicate-event filter)
- [x] WebDAV sync reliability: 423-locked retry + status-0 retry for push
- [x] `<font>` tag override: font face/size controls now work on old table-layout ePubs
- [x] Excessive `<br/>` spacing collapsed: old PDF-converted ePubs no longer waste a third of each page on whitespace
- [x] Share Page from Book menu (webOS email / Web Share API / mailto fallback)
- [x] Pop-balloon popup white rectangle fixed on webOS (theme class propagation + `-webkit-border-image: none`)
- [x] Search within book wired end-to-end (toolbar → panel → EpubRenderer, re-entrancy guard)
- [x] Furthest read position bookmark (high-water mark, never moves backward)
- [x] Oversized image skip: ePubs with large covers (>1MB) now import in normal time on webOS
- [x] Enyo package size: removed unused g11n locale data (phone/address/name) and test images (~2.6MB savings)
- [x] Dictionary look-up (Define mode): tap a word to define it (geometric hit-test, tapped-word highlight, webOS font caveats handled)
- [x] Discuss in Claude (optional, off by default): hands prev/current/next page + title/author to the Claude Chat app as hidden context via `applicationManager/launch` on webOS, or opens claude.ai with a prefilled prompt on PWA/desktop; gated by the Enable AI Features setting

### Not Yet Implemented
- [ ] Location slider navigation
- [ ] Text selection for highlights
- [ ] Highlight/annotation editing UI
- [ ] Smooth scroll mode (getTriplePage)
- [ ] Reading statistics

---

## Reference: Original Apps

### Kindle Beta App (Enyo UI)
- Framework: Enyo 0.10
- Used native C++ plugins (KRF, KCF) for rendering and Amazon sync
- We kept the UI, replaced native plugins with JavaScript

### pReader App (Mojo UI)
- Framework: Mojo (older webOS framework)
- Pure JavaScript ePub engine
- We extracted the rendering engine (`src/` directory)

---

## Git Repository

```
origin: git@github.com:codepoet80/webos-papyrus-ereader.git
```
