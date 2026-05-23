# Papyrus PWA Migration Plan

A planning document for turning Papyrus into a cross-platform Progressive Web App.
Not a commitment to do it now — a roadmap for when we're ready.

---

## The Good News

The hardest part — the ePub rendering engine — is pure JavaScript and fully portable.
Everything in `src/` (ZIP parsing, HTML processing, pagination, WebSQL storage) runs
in any modern browser today with zero changes. The WebDAV sync is already XHR-based
and works cross-platform. The settings and library are already in localStorage.

The work is almost entirely in the Enyo 1 + webOS API surface layer, not the engine.

---

## What Needs to Change

### 1. Framework Loading ✅ DONE

Enyo is now bundled locally in `enyo/` (copied from enyo1-flixnet). `index.html` loads
from `enyo/enyo.js` instead of the webOS system path. The `launch="nobridge"` webOS
attribute was also removed. The app still works identically on the TouchPad; the package
is ~7MB larger but the framework is now ours to modify.

**TODO — Externalize Enyo:** The `enyo/` directory (~7MB, 981 files) is committed directly
into the repo, which bloats git history. Long-term, Enyo should live in its own repo
(a fork of enyo1 with our flex-grow patch applied), published as a release artifact or
hosted on a CDN, and referenced via `<script src="...">` in `index.html`. That keeps
this repo lean and makes the Enyo modifications reviewable in isolation.

The rest of `index.html` still needs PWA meta tags added when we do Phase 3
(see `enyo2-checkmate/index.html` as a template).

---

### 2. webOS-Specific APIs (the main work)

Every webOS API used in the app needs a browser equivalent or a graceful stub.
The existing `window.PalmSystem` checks in the code give us a clean detection point.

| webOS API | Where Used | Browser Replacement | Status |
|---|---|---|---|
| `FilePicker` kind | `Main.js` | `<input type="file" accept=".epub" multiple>` | ✅ Done — `webos-compat.js` |
| `palm://com.palm.applicationManager` | `Main.js` | `window.open()` for browser launch; stub listApps | ✅ Stubbed via `PalmService` no-op |
| `palm://com.palm.display/control/` | `Main.js`, `BrightnessBox.js` | Screen Wake Lock API (`navigator.wakeLock`) | ✅ Done — `webos-compat.js`; brightness button hidden |
| `palm://com.palm.keys/audio/` | `BookReader.js` | `KeyboardEvent` listeners (arrow keys / page up/down) | ✅ Done — `BookReader.js` |
| `palm://ca.canucksoftware.filemgr/` | `Main.js` | Not needed — File API replaces the whole flow | ✅ Done — `FileImporter.js` browser path |
| `palm://com.palm.db/` | `Main.js` | Not needed — media rescan not applicable in browser | ✅ Stubbed via `PalmService` no-op |
| `enyo.windows.setWindowProperties({blockScreenTimeout})` | `Main.js`, `BookReader.js` | `navigator.wakeLock.request('screen')` | ✅ Done — `webos-compat.js` |
| `enyo.windows.addBannerMessage()` | `Main.js`, `BookReader.js` | DOM toast notification | ✅ Done — `webos-compat.js` |
| `ApplicationEvents` kind | `Main.js` | `window.addEventListener('focus'/'blur'/'resize')` | ✅ Done — `webos-compat.js` |
| `PalmServiceBridge` | `FileImporter.js` | Failure stub; browser path uses FileReader API | ✅ Done — `webos-compat.js` + `FileImporter.js` |
| `Helpers.Updater` / App Museum | `Main.js` | Show a "check for updates" link or hide entirely | Not yet addressed |

All browser shims live in `webos-compat.js` — no `if (window.PalmSystem)` scattered through app code.

---

### 3. File Import ✅ DONE

`webos-compat.js` provides a `FilePicker` shim wrapping `<input type="file">`. `FileImporter.js`
detects browser `File` objects and routes them through a `FileReader` → `ArrayBufferByteReader` →
`ZipFile` → `EpubReader` path. `Main.js` `handleFilePicked` detects File objects and bypasses
the webOS path-extraction logic. ZipFile, EpubReader, and HTMLBook are unchanged.

---

### 4. BrightnessBox ✅ DONE

Brightness button hidden on non-webOS (`top_row.js`). CSS filter dimming deferred — may
revisit as an optional enhancement.

---

### 5. WebSQL — The Biggest Risk

The rendering engine stores paginated book content in WebSQL (`src/io/Database.js`).
WebSQL status by platform:

| Platform | Status |
|---|---|
| Chrome / Edge | Works, but formally deprecated (no removal date announced yet) |
| Safari / iOS | Works (Apple never deprecated it) |
| Firefox | Never implemented, never will |
| Android Chrome | Works (same as desktop Chrome) |

**For a first pass**: ignore Firefox. Chrome and Safari cover the vast majority of
desktop and mobile users, and WebSQL still works in both.

**Long-term**: Replace `Database.js` with an IndexedDB wrapper that presents the same
interface (`openDatabase`-compatible shim). The `sql.js` library (SQLite compiled to
WASM) is the most drop-in path — it implements the WebSQL API exactly. This is a
contained change since the rest of the engine talks to `Database.js` through a clean
abstraction.

---

### 6. Responsive Layout

The app is designed for the TouchPad's 1024×768 landscape screen. On other devices:

- **Desktop browsers**: Probably fine as-is at 1024+ width.
- **iPad landscape**: Same resolution class, should work.
- **iPhone / Android portrait**: Would need real work — the library grid, slideout panel,
  and reader toolbar all assume landscape orientation and fixed widths.

Recommend targeting desktop + tablet landscape first. Mobile portrait is a separate
effort.

---

### 7. PWA Shell

Use `enyo2-checkmate` as the template. It already has:
- `manifest.json` with full icon set
- `serviceworker.js` with network-first + cache-fallback strategy
- iOS meta tags and bounce prevention
- Install prompt handling

Copy those files, update app name/colors/icons, and add the app shell URLs to the
service worker's static cache list.

---

## Recommended Phases

### Phase 1 — Run in a Browser (no webOS device needed)
1. ✅ Bundle Enyo 1 locally (copied from enyo1-flixnet into `enyo/`)
2. ✅ Update `index.html` to load local Enyo (removed webOS system path)
3. ✅ Stub all webOS-specific APIs via `webos-compat.js` (PalmService, FilePicker, ApplicationEvents, PalmServiceBridge, enyo.windows.*, enyo.fetchAppInfo, enyo.fetchDeviceInfo, $L)
4. ✅ `webos-compat.js` loaded in `index.html` after enyo.js, exits immediately on real webOS
5. Add PWA meta tags to `index.html`
6. Goal: app loads, library shows, books open, reading works

### Phase 2 — File Import ✅ READY FOR REVIEW
1. ✅ Replace `FilePicker` with `<input type="file">` on non-webOS (via webos-compat.js shim)
2. ✅ `FileImporter.js` detects browser File objects and uses FileReader API + ArrayBufferByteReader
3. ✅ `Main.js` handleFilePicked routes browser File objects directly, bypassing webOS path extraction
4. Goal: can import ePubs in a browser ✅

### Phase 3 — PWA Infrastructure ✅ READY FOR REVIEW
1. ✅ `manifest.json` — name, orientation:landscape, theme color, full icon set
2. ✅ `serviceworker.js` — shell pre-cache on install, cache-on-fetch for full offline after first load
3. ✅ 18 icon sizes generated from `meta/icon-512.png` into `icons/` (16–512px)
4. ✅ PWA meta tags, apple-touch-icon links, manifest link, SW registration added to `index.html`
5. Test "Add to Home Screen" on iOS and Android

### Phase 4 — Platform Polish ✅ READY FOR REVIEW
1. ✅ Wake Lock API for screen-on (replaces `setWindowProperties`) — in `webos-compat.js`
2. ✅ In-app toast notifications (replaces `addBannerMessage`) — in `webos-compat.js`
3. ✅ Keyboard navigation for page turns — arrow keys, PageUp/Down, Space in `BookReader.js`
4. ✅ Brightness slider hidden on non-webOS (`top_row.js`); CSS filter dimming deferred
5. Goal: feature parity with webOS version on supported platforms ✅

### Phase 5 — Enyo 1 FlexLayout Browser Compatibility ⚠️ IN PROGRESS

Enyo 1 uses `-webkit-box-flex` (old flexbox spec). Modern Chrome supports this for
backwards compatibility, but the `flow()` / `flowExtent()` functions in Enyo's layout
engine write properties that break under the modern flex model.

**Fixed in `enyo/build/enyo-build.js` line 2774 (`flowExtent`):**
- Changed `f["flex"] = g` → `f["flex-grow"] = g`
  - `flex:1` shorthand sets `flex-basis:0%` (collapsing containers to zero width)
  - `flex-grow:1` preserves `flex-basis:auto` (reads the element's natural width)
- Removed `(f[b] || (f[b] = "0px"))` which wrote `width:0px` as an inline style,
  locking `flex-basis` to 0 and collapsing flex children
- Also in `flow()` (line 2778): added `justify-content` and `align-items` writes
  to container `domStyles` in addition to the old webkit-prefixed equivalents

**`enyo/build/enyo-build.css`:** already has `display:flex; flex-direction:row/column`
on `.enyo-hflexbox`/`.enyo-vflexbox` (from earlier session).

**Result:** ContentNavigator toolbar (sort dropdown, grid/list toggle, search icon)
now lays out correctly instead of stacking/collapsing.

**⚠️ Remaining issue:** After the flex-grow fix, the book grid appears ~80px shifted
to the right. Root cause not yet identified analytically. Next step: use DevTools
Elements panel to find which ancestor of the book covers has a non-zero `left`,
`margin-left`, `padding-left`, or `transform/translateX`. Candidates to inspect:
gridContainer → gridScroller → contentView → ContentNavigator div → content-panel div.

**Important warning:** Do NOT add `!important` to `.enyo-hflexbox` or `.enyo-vflexbox`
CSS rules — this breaks VFlexBox layout, causing books to become un-tappable and the
"No books" indicator to appear over actual books.

---

### Phase 6 — WebSQL Future-Proofing (if Firefox support matters)
1. Evaluate `sql.js` (SQLite WASM) as a drop-in replacement for `Database.js`
2. Or write a thin IndexedDB adapter behind the same interface
3. Goal: Firefox support

---

## Reference Files

| File | Role |
|---|---|
| `enyo1-flixnet/enyo-app/` | How to bundle Enyo 1 locally for browser use |
| `enyo2-checkmate/enyo-app/index.html` | Full PWA index.html template |
| `enyo2-checkmate/enyo-app/manifest.json` | PWA manifest template |
| `enyo2-checkmate/enyo-app/serviceworker.js` | Service worker template |
| `com.palm.codepoet.papyrus/src/io/Database.js` | WebSQL abstraction to eventually replace |
| `com.palm.codepoet.papyrus/app/common/FileImporter.js` | File import — swap picker, keep parser |
| `com.palm.codepoet.papyrus/app/Main.js` | Most webOS API calls concentrated here |

---

## What Won't Change

- `src/` — the entire rendering engine is portable as-is
- `app/common/SyncManager.js` — already plain XHR, works everywhere
- `app/panels/` — TOC, search, bookmarks panels are pure Enyo UI
- `app/userPreferences/Settings.js` — localStorage-based, works everywhere
- All CSS — Enyo 1 CSS translates directly

The app is probably 60-70% of the way there already.
