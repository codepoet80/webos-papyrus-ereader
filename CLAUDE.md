# WebOS E-Reader Merger Project

## Project Goal

Merge two webOS e-reader applications:
1. **Kindle app** (`com.palm.app.kindle_0.12.50_all`) - Beautiful Enyo-based UI, but proprietary C++ backend
2. **Preader app** (`com.mhwsoft.preader_0.8.21_all`) - Basic Mojo UI, but working pure-JavaScript ePub engine

The goal is to take Kindle's polished frontend and replace its broken proprietary backend with Preader's open-source JavaScript rendering engine.

---

## Current Status: WORKING MILESTONE ✓

The merged app **com.webos.ereader** is functional:
- Library grid displays imported books
- Books can be opened and read
- Page turns work (tap left/right edges)
- Themes work (white/sepia/black)
- Font controls work
- Reading position is saved
- Library button returns to grid view

**Known Issues to Address:**
- Some books have pagination imperfections (content sizing)
- Location slider doesn't work
- Some books with large images may have layout issues
- Highlights/annotations not fully implemented

---

## Directory Structure

```
/Users/jonwise/Projects/webos-ereader/
├── com.webos.ereader/                       # ★ MERGED PROJECT (active)
│   ├── app/                                 # Kindle UI (Enyo components)
│   │   ├── Main.js                          # Simplified, no Amazon
│   │   ├── reading/
│   │   │   ├── body.js                      # Uses EpubRenderer
│   │   │   └── BookReader.js                # Touch handling fixed
│   │   └── common/
│   │       ├── EpubRenderer.js              # ★ KRF replacement
│   │       └── MojoCompat.js                # Mojo compatibility layer
│   ├── src/                                 # Preader engine (ported)
│   │   ├── pdb/EpubReader.js
│   │   ├── display/PageFitter.js            # Modified for Enyo
│   │   ├── display/HTMLBook.js
│   │   └── ...
│   └── books/                               # Test ePubs
├── com.palm.app.kindle_0.12.50_all/         # Original Kindle (reference)
├── com.mhwsoft.preader_0.8.21_all/          # Original Preader (reference)
└── CLAUDE.md                                # This file
```

---

## Quick Start Commands

```bash
# Build and deploy
cd /Users/jonwise/Projects/webos-ereader
palm-package com.webos.ereader && palm-install com.webos.ereader_*.ipk

# Launch app
palm-launch com.webos.ereader

# View device logs (for debugging)
palm-log -f com.webos.ereader
```

---

## Key Learnings & Fixes Applied

### 1. Enyo VFlexBox + CSS Positioning

**Problem:** Absolutely positioned children don't participate in flex layout.

**Solution:** Use `position: relative` with `flex: 1` for the EpubRenderer so it fills the VFlexBox, then absolutely position children inside it.

```css
/* CORRECT - participates in flex layout */
.epub-renderer {
    position: relative;  /* NOT absolute */
    width: 100%;
    height: 100%;
}

.epub-page-container {
    position: absolute;  /* OK - parent is positioned */
    top: 20px; left: 30px; right: 30px; bottom: 20px;
}
```

```javascript
// In body.js - must have flex: 1
{kind: "EpubRenderer", name: "epubRenderer", flex: 1, className: "epub-renderer", ...}
```

### 2. Mojo to Enyo Compatibility

Preader uses Mojo's `Element.prototype.update()`. Created `MojoCompat.js` polyfill, but ultimately modified PageFitter to use `.innerHTML` directly:

```javascript
// PageFitter.js - changed from:
this.offscreen.update(text);
// To:
this.offscreen.innerHTML = text || "";
```

### 3. Book Loading from Database

Books are pre-imported into WebSQL databases. EpubRenderer loads via `bookDbName` rather than re-parsing ePub files:

```javascript
// body.js passes bookDbName
this.$.epubRenderer.initializeBook(
    book.bookFilePath,
    book.locationsCompleted || 0,
    highlightsJSON,
    this.animationState,
    fontSize, fontType, theme,
    book.bookDbName  // ★ Load from existing HTMLBook database
);
```

### 4. Screen Height Calculation

PageFitter needs consistent height for pagination. Use actual container height:

```javascript
getScreenHeight: function() {
    var container = this.$.pageContainer.hasNode();
    if (container && container.offsetHeight > 0) {
        return container.offsetHeight;
    }
    return window.innerHeight - 160;  // Fallback
}
```

### 5. Touch Event Handling

Touch handling was interfering with overlays. Fixed in BookReader.js:

```javascript
handleMouseDown: function(inSender, inEvent) {
    var x = inEvent.pageX || inEvent.clientX;
    var width = window.innerWidth;

    if (x < width * 0.25) {
        if (!this.overlaysShowing) {
            this.$.body.previousPage();
        } else {
            this.hideOverlays();
        }
    } else if (x > width * 0.75) {
        if (!this.overlaysShowing) {
            this.$.body.nextPage();
        } else {
            this.hideOverlays();
        }
    } else {
        this.showOverlays();
    }
}
```

### 6. Large Image Handling

Large images caused PageFitter to get stuck. Fixed by limiting image height:

```javascript
// PageFitter.js handleImage()
var maxImageHeight = Math.floor(size * 0.6);  // 60% of screen
```

### 7. Library Persistence

Reading positions saved to localStorage (simplified from MojoDB):

```javascript
// Main.js
updateBookInLibrary: function(book) {
    var library = JSON.parse(localStorage.getItem("ereader_library") || "[]");
    for (var i = 0; i < library.length; i++) {
        if (library[i].asin === book.asin) {
            library[i].locationsCompleted = book.locationsCompleted;
            library[i].lastAccessed = book.lastAccessed;
            break;
        }
    }
    localStorage.setItem("ereader_library", JSON.stringify(library));
}
```

---

## Architecture: Key Modified Files

| File | Changes Made |
|------|--------------|
| `app/common/EpubRenderer.js` | Created - wraps Preader's PageFitter/HTMLBook with KRF-compatible API |
| `app/common/MojoCompat.js` | Created - Mojo polyfills for Preader code |
| `app/reading/body.js` | Replaced KRF Hybrid with EpubRenderer component |
| `app/reading/BookReader.js` | Fixed touch handling for page turns |
| `app/Main.js` | Removed Amazon code, added localStorage library, updateBookInLibrary() |
| `app/common/common.css` | Added epub-renderer, epub-page-container styles |
| `src/display/PageFitter.js` | Changed .update() to .innerHTML, added image sizing |
| `src/display/HTMLBook.js` | Debug logging (can be removed) |

---

## Test Books

Located in `com.webos.ereader/books/`:
- Anne Frank's Diary - has large images, tests image handling
- Accelerando - longer book, tests pagination
- Catcher in the Rye - standard formatting
- (others)

Books must be imported first - the app doesn't have a file picker yet. Import via Preader or manual database entry.

**Important:** The Kindle app is packaged. Run this to extract:
```bash
cd com.palm.app.kindle_0.12.50_all && tar -xzf data.tar.gz
```

---

## Kindle App Architecture

### Framework
- **Enyo 0.10** - webOS component-based UI framework
- Components defined via `enyo.kind({...})`
- Event-driven with published properties

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `app/Main.js` | 2067 | App orchestrator, plugin management, sync logic |
| `app/reading/BookReader.js` | 685 | Reader container, coordinates body/toolbar |
| `app/reading/body.js` | 936 | **Critical** - KRF plugin wrapper, annotations |
| `app/common/BookData.js` | ~100 | Book metadata structure |
| `app/common/Database.js` | ~150 | MojoDB schema definitions |

### Component Hierarchy
```
kindle.Main
├── Pane (view switcher)
│   ├── amazonLoginForm (registration)
│   ├── navigator (library view)
│   │   └── MainPanels (SlidingPane)
│   │       ├── LibraryNavigator (sidebar)
│   │       └── ContentNavigator (grid/list)
│   └── reader (BookReader)
│       ├── top_row (toolbar)
│       ├── body (book rendering via KRF)
│       └── bottom_row (progress)
└── Toaster (slideout panels)
```

### Native Plugins (C++ - What We're Replacing)

#### KRF Plugin (Kindle Rendering Framework)
- **Location:** Embedded in `body.js` as `enyo.Hybrid`
- **Executable:** `KindlePluginUtil`
- **Purpose:** Renders book content, handles pagination

**Methods called on KRF:**
```javascript
// Initialization
initializeBook(bookPath, location, highlightsJSON, animation, fontSize, fontType, theme)

// Navigation
gotoLocation(location)
gotoPosition(position)
gotoBeginning()
gotoTableOfContents()
historyBack()
gotoLocationSearchResult(location)
gotoPageContainingBuffer(pagePos, startPos, snapshotBuffer)

// Rendering control
setFontSize(size)           // 12-32
setTypeFace(type)           // 0=Georgia, 1=Verdana
setNightModeColor(color)    // 0=white, 1=sepia, 2=black
refreshPage()
refreshHighlights(highlightsJSON)
overlayStateChange(state)   // "showing" or "hidden"
canChangeFont()

// Annotations
highlightUserSelectedArea()
deleteSelectedHighlight()
getInfoForStoringNote()
getInfoForStoringBookmark()
getCoveringRectJSONForPositionIDs(positionString)
highlightThisPositionID(positionId)
highlightMultiplePositionIDs(positionId, numWords)

// Utilities
getCurrentPOSIXTimeStamp()
convertPositionToLocation(position)
isHistoryBackExist()
resetSearch()
```

**Callbacks from KRF:**
```javascript
doRefreshPage(locationInfo, isTOCAvailable)
// locationInfo format: "StartLoc-EndLoc#Percent%#StartPos-EndPos"
// Example: "330-342#17%#49416-51200"

initializeBookCompleted()
showOverlays()
hideOverlays()
showNoteHighlight(noteData)
// noteData format: "mouseX:mouseY:wordX:wordY:wordW:wordH:showDelete:startPos:endPos"

hideNoteHighlight()
hideDeleteHighlightButton()
showNotes()
hideNotes()
updateDBUsingJSONFiles(bookASIN)
openExternalLink(url)
openBuyNowShowDetailLink(asin)
krfPluginError(errorMessage)
enableBackButton(action)  // "true" or "false"
endofBook(firstpage)
```

#### KCF Plugin (Kindle Content Framework)
- **Executable:** `plugin_kcf`
- **Purpose:** Amazon backend communication (NOT NEEDED for ePub reader)

**Methods (for reference, will be removed):**
- RegisterDevice, Deregister
- DownloadBook, DeleteBookFile, DeleteSampleBook
- WhisperSyncLibrary, SyncArchiveMetadata
- GetAnnotations, UpdateDBUsingFilesGeneratedByKRF
- ConvertPositionToLocation, GetCollections, StoreURL

### Data Model (BookData.js)

```javascript
BookData {
    asin: string,              // Amazon ID (we'll use file hash)
    guid: string,              // Edition ID (can remove)
    type: string,              // "EBOK", "EBSP", etc (simplify to "EPUB")
    title: string,
    author: string,
    coverImagePath: string,
    bookFilePath: string,
    isArchived: boolean,       // Remove (no cloud)
    isSample: boolean,         // Remove
    downloadProgress: number,  // Remove
    lastAccessed: timestamp,
    locationsCompleted: number,
    locationsTotal: number,
    numMarkups: number,
    categories: array
}
```

---

## Preader App Architecture

### Framework
- **Mojo** - Older webOS framework (scene/assistant pattern)
- Scenes defined in `app/assistants/`
- HTML templates in `app/views/`

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/pdb/EpubReader.js` | 829 | ePub parsing and validation |
| `src/display/HTMLBook.js` | 350 | Book storage with chunked DB |
| `src/display/PageFitter.js` | 450 | Binary search pagination |
| `src/display/HTMLBuffer.js` | 200 | Chunk with tag tracking |
| `src/display/HTMLParser.js` | 300 | HTML tag extraction |
| `src/io/Database.js` | 150 | WebSQL wrapper |
| `src/io/ZipFile.js` | 400 | ZIP archive handling |
| `src/io/Inflate.js` | 800 | DEFLATE decompression |
| `src/library/Library.js` | 200 | Book collection management |
| `src/library/LibraryEntry.js` | 150 | Book metadata |
| `app/assistants/Reader-assistant.js` | 2000+ | Reader UI controller |

### ePub Processing Pipeline

```
1. VALIDATION (EpubReader.js)
   └── Check mimetype file = "application/epub+zip"
   └── Check for DRM (META-INF/encryption.xml → reject if present)
   └── Parse META-INF/container.xml for rootfile

2. STRUCTURE EXTRACTION
   └── Parse OPF file (manifest + spine)
   └── Extract chapter list from spine
   └── Build reading order

3. CONTENT LOADING (async)
   └── Decompress XHTML chapters via ZipFile/Inflate
   └── Decompress images
   └── Parse HTML, strip problematic tags

4. CHUNKING (HTMLBook.js + HTMLBuffer.js)
   └── Split content into 4KB buffers
   └── Track open tags across boundaries
   └── Calculate byte offsets for seeking

5. DATABASE STORAGE
   └── Store metadata in WebSQL
   └── Store each buffer as separate record
   └── Store images as base64

6. PAGE FITTING (PageFitter.js)
   └── Binary search to find content that fits screen height
   └── Render to offscreen div to measure
   └── Handle image scaling
   └── Find safe break points (not mid-word)
```

### Key Interfaces

#### HTMLBook
```javascript
new HTMLBook(reader, isPlainText, dbName, callback)

// Reading content
book.read(startPos, length, callback)  // Async, returns via callback
book.readIsAsync()                      // Always returns true
book.getLength()                        // Total book length in bytes
book.getImage(label, callback)          // Get base64 image data
book.getPosForBookmarkLabel(label)      // Find anchor position

// State
book.isReady                            // Loading complete
book.callback(book)                     // Called when ready
```

#### PageFitter
```javascript
new PageFitter(htmlBook, offscreenElement, encoding)

// Navigation
fitter.getCurrPage(screenHeight, callback)
fitter.getNextPage(screenHeight, callback)
fitter.getPrevPage(screenHeight, callback)
fitter.gotoPage(bytePosition, sanitize)
fitter.getTriplePage(screenHeight, callback)  // For smooth scroll

// Callback receives: function(htmlString, startPos, endPos)
```

#### LibraryEntry
```javascript
LibraryEntry {
    uid: string,           // Unique ID
    name: string,          // Display name
    bookDbName: string,    // Database key for HTMLBook
    currReadingPos: number,// Byte position
    length: number,        // Total bytes
    author: string,
    title: string,
    publisher: string,
    language: string,
    category: string,
    encoding: number,      // Character encoding
    bookmarks: array,      // [{label, position}]
    expireDate: Date       // For DRM (not used for open ePub)
}
```

### Rendering Flow (Reader-assistant.js)

```javascript
// Page navigation
handleNextPage() {
    var size = this.getScreenSize();
    this.fitter.getNextPage(size, this.displayString.bind(this, 1));
}

// Display result
displayString(direction, html) {
    this.text.update(html);  // Update DOM div
    this.saveEntry();        // Persist reading position
}
```

---

## Implementation Strategy

### Phase 1: Setup
1. Create new project `com.webos.ereader/`
2. Copy Kindle's app/ structure (Enyo components)
3. Copy Preader's src/ directory (JS engine)

### Phase 2: Create EpubRenderer (KRF Replacement)

New Enyo component at `app/common/EpubRenderer.js`:

```javascript
enyo.kind({
    name: "EpubRenderer",
    kind: "Control",

    // Internal state
    htmlBook: null,
    pageFitter: null,
    currentStart: 0,
    currentEnd: 0,
    totalLength: 0,

    // DOM for rendering
    components: [
        {name: "pageContent", className: "epub-content"},
        {name: "offscreen", className: "epub-offscreen", style: "position:absolute;top:-5000px;"}
    ],

    // KRF-compatible interface
    initializeBook: function(path, location, highlights, anim, fontSize, fontType, theme) {
        var epubReader = new EpubReader(path);
        epubReader.load(enyo.bind(this, function() {
            this.htmlBook = new HTMLBook(epubReader, false, this.makeDbName(path),
                enyo.bind(this, "bookReady"));
        }));
    },

    bookReady: function() {
        this.totalLength = this.htmlBook.getLength();
        this.pageFitter = new PageFitter(this.htmlBook, this.$.offscreen.node, 0);
        this.fireCallback("initializeBookCompleted");
        this.gotoLocation(this.initialLocation || 0);
    },

    gotoLocation: function(loc) {
        var bytePos = Math.floor((loc / 100) * this.totalLength);
        this.pageFitter.gotoPage(bytePos);
        this.refreshPage();
    },

    refreshPage: function() {
        var screenHeight = this.getBounds().height;
        this.pageFitter.getCurrPage(screenHeight, enyo.bind(this, "displayPage"));
    },

    displayPage: function(html, start, end) {
        this.$.pageContent.setContent(html);
        this.currentStart = start;
        this.currentEnd = end;

        var percent = Math.floor((start / this.totalLength) * 100);
        var locInfo = start + "-" + end + "#" + percent + "%#" + start + "-" + end;
        this.fireCallback("doRefreshPage", locInfo, "false");
    },

    // ... implement remaining KRF methods
});
```

### Phase 3: Modify body.js

Replace:
```javascript
{kind: enyo.Hybrid, name: "krfPlugin", executable: "KindlePluginUtil", ...}
```

With:
```javascript
{kind: "EpubRenderer", name: "epubRenderer",
    onInitializeBookCompleted: "initializeBookCompleted",
    onDoRefreshPage: "doRefreshPage",
    // ... other callbacks
}
```

Update all calls from:
```javascript
this.$.krfPlugin.callPluginMethodDeferred(callback, "methodName", args)
```

To:
```javascript
this.$.epubRenderer.methodName(args)
```

### Phase 4: Simplify Main.js

Remove:
- All KCF plugin code
- Amazon authentication
- WhisperSync
- Archive management
- Download queue

Add:
- Local ePub file scanning
- File picker integration
- WebSQL-based library storage

### Phase 5: Adapt Data Models

Create adapter function:
```javascript
function preaderToKindleBook(libraryEntry, htmlBook) {
    return {
        asin: libraryEntry.uid,
        title: libraryEntry.title || libraryEntry.name,
        author: libraryEntry.author || "",
        bookFilePath: "internal://" + libraryEntry.bookDbName,
        locationsCompleted: Math.floor((libraryEntry.currReadingPos / libraryEntry.length) * 100),
        locationsTotal: 100,  // Use percentage
        lastAccessed: Date.now(),
        categories: libraryEntry.category ? [libraryEntry.category] : [],
        numMarkups: libraryEntry.bookmarks.length
    };
}
```

---

## Testing Strategy

### Unit Tests
1. Load ePub via EpubReader, verify metadata extraction
2. Create HTMLBook, verify chunking works
3. Use PageFitter, verify page boundaries

### Integration Tests
1. Display page in EpubRenderer component
2. Navigate forward/backward
3. Change font size, verify reflow
4. Change theme colors

### Device Tests
1. Install on actual HP TouchPad
2. Import ePub file
3. Full reading session
4. Verify memory usage acceptable

---

## Files Reference

### Kindle Files (After Extraction)

```
com.palm.app.kindle_0.12.50_all/usr/palm/applications/com.palm.app.kindle/
├── app/
│   ├── Main.js                          # 2067 lines - main orchestrator
│   ├── Main.css
│   ├── common/
│   │   ├── BookData.js                  # Book metadata class
│   │   ├── Database.js                  # MojoDB schemas
│   │   ├── KRFPluginWrapper.js          # Legacy wrapper (not used)
│   │   ├── KCFPluginWrapper.js          # Legacy wrapper (not used)
│   │   └── ...
│   ├── reading/
│   │   ├── BookReader.js                # 685 lines - reader container
│   │   ├── body.js                      # 936 lines - KRF integration ★
│   │   ├── top_row.js                   # Toolbar with font/brightness
│   │   ├── bottom_row.js                # Progress bar
│   │   ├── FontBox.js
│   │   ├── BrightnessBox.js
│   │   └── ...
│   ├── contentContainer/
│   │   ├── ContentNavigator.js          # Library main view
│   │   ├── GridView.js                  # Grid layout
│   │   ├── ListView.js                  # List layout
│   │   └── ...
│   ├── libraryNavigator/
│   │   └── LibraryNavigator.js          # Sidebar categories
│   ├── panels/
│   │   ├── SlideoutPanel.js
│   │   └── SlideoutPanelViews/
│   │       ├── TocView.js               # Table of contents
│   │       ├── SearchView.js            # Search results
│   │       ├── MarkupsView.js           # Annotations
│   │       └── CoverView.js             # Book cover
│   └── userPreferences/
│       └── Settings.js
├── appinfo.json
├── depends.js
├── framework_config.json
└── images/
```

### Preader Files

```
com.mhwsoft.preader_0.8.21_all/usr/palm/applications/com.mhwsoft.preader/
├── src/
│   ├── pdb/
│   │   ├── EpubReader.js                # 829 lines - ePub parser ★
│   │   ├── MobiReader.js                # Mobi format
│   │   ├── HtmlReader.js                # HTML format
│   │   └── ...
│   ├── display/
│   │   ├── HTMLBook.js                  # 350 lines - book storage ★
│   │   ├── PageFitter.js                # 450 lines - pagination ★
│   │   ├── HTMLBuffer.js                # 200 lines - chunking
│   │   └── HTMLParser.js                # 300 lines - tag parsing
│   ├── io/
│   │   ├── Database.js                  # WebSQL wrapper
│   │   ├── ZipFile.js                   # ZIP handling
│   │   ├── Inflate.js                   # Decompression
│   │   └── File.js                      # File loading
│   ├── library/
│   │   ├── Library.js                   # Collection management
│   │   └── LibraryEntry.js              # Book metadata
│   └── encodings/
│       ├── CP*.js                       # Code pages
│       └── ...
├── app/
│   ├── assistants/
│   │   ├── Reader-assistant.js          # Reader UI
│   │   └── ...
│   └── views/
└── appinfo.json
```

---

## Implementation Status

### ✅ Completed

1. **Image handling:** Images stored as base64 with labels. HTMLBook.getImage() retrieves them. PageFitter.handleImage() scales large images to 60% of screen height.

2. **Font rendering:** Working - setFontSize() and setTypeFace() update CSS and trigger page reflow via refreshPage().

3. **Theme colors:** Working - setNightModeColor() applies white/sepia/black themes via applyTheme().

4. **Memory management:** HTMLBook's chunked 4KB buffer system preserved from Preader.

5. **Basic reading:** Page turns, position tracking, library navigation all functional.

### 🔧 Needs Work

1. **Location slider:** The progress slider in bottom_row doesn't work. Need to wire its events to EpubRenderer.gotoLocation().

2. **TOC panel:** SlideoutPanel for table of contents needs to fetch TOC from EpubReader and navigate on selection.

3. **File import:** No file picker yet. Books must be pre-imported. Need to add "Import ePub" button that uses webOS file picker.

4. **Search:** SearchView panel needs implementation - use HTMLBook.read() to search content.

5. **Highlights/annotations:** Stub methods exist but selection and persistence not implemented.

6. **Smooth scrolling:** Optional - Preader's getTriplePage() for smooth scroll not implemented.

### 🐛 Known Bugs

1. Some books have inconsistent page sizing - may need PageFitter tuning
2. Very large images can still cause layout issues
3. Some ePubs with unusual structure may not parse correctly

---

## TODO List

### High Priority
- [ ] Fix character/encoding problems
- [ ] Work on page-turning consistency
- [ ] Fix location slider in bottom_row.js - wire drag events to EpubRenderer.gotoLocation()
- [ ] Wire TOC panel (SlideoutPanelViews/TocView.js) to fetch TOC from EpubReader and navigate
- [ ] Add "Import ePub" button to library - use webOS file picker service
- [ ] Test and fix pagination issues with remaining test books

### Medium Priority
- [ ] Implement search (SlideoutPanelViews/SearchView.js) - search HTMLBook content
- [ ] Add cover image extraction from ePub metadata for library grid
- [ ] Implement text selection for highlights
- [ ] Persist annotations to localStorage or WebSQL

### Low Priority / Nice to Have
- [ ] Smooth page transitions (CSS animations)
- [ ] Implement getTriplePage() for smooth scrolling mode
- [ ] Add reading statistics (time spent, pages read)
- [ ] Support more ePub edge cases (encrypted fonts, external resources)

### Cleanup
- [ ] Remove debug console.log statements from PageFitter, HTMLBook, HTMLParser
- [ ] Remove unused Kindle/Amazon code remnants from Main.js
- [ ] Clean up commented-out code in body.js

---

## Reference Commands

```bash
# Build and deploy (primary workflow)
cd /Users/jonwise/Projects/webos-ereader
palm-package com.webos.ereader && palm-install com.webos.ereader_*.ipk && palm-launch com.webos.ereader

# View device logs
palm-log -f com.webos.ereader

# Extract original Kindle app (if needed)
cd com.palm.app.kindle_0.12.50_all && tar -xzf data.tar.gz

# View key source files
cat com.webos.ereader/app/common/EpubRenderer.js
cat com.webos.ereader/app/reading/body.js
cat com.webos.ereader/src/display/PageFitter.js

# Detailed plan file
cat /Users/jonwise/.claude/plans/encapsulated-mixing-dongarra.md
```
