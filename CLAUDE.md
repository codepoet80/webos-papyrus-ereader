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
# Build and deploy
cd /Users/jonwise/Projects/webos-ereader
palm-package com.palm.codepoet.papyrus && palm-install com.palm.codepoet.papyrus_*.ipk

# Launch app
palm-launch com.palm.codepoet.papyrus

# View device logs (for debugging)
palm-log -f com.palm.codepoet.papyrus

# Full build-install-launch cycle
palm-package com.palm.codepoet.papyrus && palm-install com.palm.codepoet.papyrus_*.ipk && palm-launch com.palm.codepoet.papyrus
```

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
    currentAppView: "library"   // Current view
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
