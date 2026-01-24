# Papyrus - WebOS ePub Reader

## Project Overview

**Papyrus** (`com.palm.codepoet.papyrus`) is an open-source ePub reader for webOS, created by merging:
1. **Kindle app** (`com.palm.app.kindle`) - Beautiful Enyo-based UI
2. **Preader app** (`com.mhwsoft.preader`) - Working pure-JavaScript ePub engine

The result is a fully functional e-reader for the HP TouchPad and other webOS devices - a new app in 2026 for a platform declared dead in 2011!

---

## Current Status: COMMUNITY BETA

The app is fully functional and ready for community testing:

### Working Features
- Library grid/list view with book covers
- Multi-select file picker for batch ePub imports
- Import progress indicator ("Importing 1 of 5...")
- Page turns (tap left/right edges of screen)
- Themes (white/sepia/black)
- Font controls (size and typeface)
- Reading position saved and restored
- Location slider navigation
- Table of Contents panel
- Search within book
- Collections/categories for organizing books
- Settings persistence
- Optional page turn animation (fade effect)
- Auto-skip blank pages

### Known Limitations
- Highlights/annotations UI not fully implemented
- Some ePubs with unusual structure may not parse correctly
- Very large images may cause layout issues in some books

---

## Directory Structure

```
/Users/jonwise/Projects/webos-ereader/
├── com.palm.codepoet.papyrus/              # ★ ACTIVE PROJECT
│   ├── app/                                 # Enyo UI components
│   │   ├── Main.js                          # App controller
│   │   ├── reading/
│   │   │   ├── body.js                      # Uses EpubRenderer
│   │   │   └── BookReader.js                # Touch handling
│   │   ├── common/
│   │   │   ├── EpubRenderer.js              # ★ Core rendering engine
│   │   │   └── MojoCompat.js                # Mojo compatibility layer
│   │   ├── contentContainer/                # Library views
│   │   ├── libraryNavigator/                # Sidebar navigation
│   │   └── panels/                          # Slideout panels (TOC, search)
│   ├── src/                                 # Preader engine (ported)
│   │   ├── pdb/EpubReader.js                # ePub parser
│   │   ├── display/PageFitter.js            # Pagination engine
│   │   ├── display/HTMLBook.js              # Book content storage
│   │   └── ...
│   └── appinfo.json
├── com.palm.app.kindle_0.12.50_all/         # Original Kindle (reference)
├── com.mhwsoft.preader_0.8.21_all/          # Original Preader (reference)
└── CLAUDE.md                                # This file
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
```

---

## Key Technical Details

### Page Turn Animation

Page turns use a subtle fade animation (80ms) that can be disabled:
- **Settings > Basic reading mode = ON**: Instant page changes
- **Settings > Basic reading mode = OFF**: Fade animation enabled

The animation respects the setting in real-time (no restart needed).

### Blank Page Skipping

The renderer automatically skips blank pages when navigating forward:
- Maximum 5 consecutive blank pages skipped
- Only skips forward (backward navigation shows all pages)
- Blank = page with no visible text content after stripping HTML tags

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

### File Import

The FilePicker returns an array of selected files:
```javascript
// Response format
[{fullPath: "/media/internal/ebooks/book.epub", size: 12345, ...}, ...]
```

Import supports multi-select - users can choose multiple ePubs and import them all at once with progress tracking.

---

## Architecture: Key Files

| File | Purpose |
|------|---------|
| `app/Main.js` | App controller, library management, settings |
| `app/common/EpubRenderer.js` | Core rendering - wraps PageFitter with Enyo events |
| `app/reading/body.js` | Book view container, coordinates with EpubRenderer |
| `app/reading/BookReader.js` | Touch handling, toolbar coordination |
| `app/contentContainer/ContentNavigator.js` | Library grid/list view |
| `app/contentContainer/ItemMenuPopup.js` | Book long-press context menu |
| `app/userPreferences/Settings.js` | Settings popup |
| `src/display/PageFitter.js` | Binary search pagination algorithm |
| `src/display/HTMLBook.js` | Chunked book storage with WebSQL |
| `src/pdb/EpubReader.js` | ePub parsing and validation |

---

## Key Fixes Applied

### 1. UTF-8 Encoding
PageFitter encoding parameter must be `2` (UTF-8), not `0` (ASCII).

### 2. Location Slider Scale
Uses fixed 0-10000 scale for `locationsTotal` instead of raw byte length.

### 3. Settings Persistence
`Main.js` reads fresh settings from localStorage before updating to avoid overwriting changes from Settings popup.

### 4. Enyo Popup Lazy Loading
Popups that need immediate access must have `lazy: false` to be available before first open.

### 5. FilePicker Response Format
FilePicker returns an array, not a single object. Access via `response[0].fullPath`.

---

## Implementation Status

### Completed
- [x] ePub parsing and rendering
- [x] Page navigation (tap zones)
- [x] Font size and typeface controls
- [x] Theme switching (white/sepia/black)
- [x] Reading position persistence
- [x] Location slider navigation
- [x] Table of Contents panel
- [x] Search within book
- [x] Cover image extraction
- [x] Multi-select file import with progress
- [x] Collections/categories
- [x] Optional page turn animation
- [x] Blank page auto-skip
- [x] Settings persistence fix

### Not Yet Implemented
- [ ] Text selection for highlights
- [ ] Highlight/annotation editing UI
- [ ] Smooth scroll mode (getTriplePage)
- [ ] Reading statistics

---

## Reference: Original Apps

### Kindle App (Enyo UI)
- Framework: Enyo 0.10
- Used native C++ plugins (KRF, KCF) for rendering and Amazon sync
- We kept the UI, replaced native plugins with JavaScript

### Preader App (Mojo UI)
- Framework: Mojo (older webOS framework)
- Pure JavaScript ePub engine
- We extracted the rendering engine (`src/` directory)

---

## Useful Commands

```bash
# Full build-install-launch cycle
palm-package com.palm.codepoet.papyrus && palm-install com.palm.codepoet.papyrus_*.ipk && palm-launch com.palm.codepoet.papyrus

# Watch logs in real-time
palm-log -f com.palm.codepoet.papyrus

# Check what's installed
palm-install --list

# Remove old version
palm-install -r com.palm.codepoet.papyrus
```
