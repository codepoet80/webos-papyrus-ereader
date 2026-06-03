# Papyrus

A modern ePub reader for webOS, built for the HP TouchPad.

Papyrus combines the polished Enyo UI of the Kindle Beta app with the pure-JavaScript ePub rendering engine from pReader, creating a fully functional open-source e-reader that doesn't depend on proprietary services.

## Features

- Clean, intuitive reading interface
- Import ePub files from your device (multi-select supported)
- Adjustable font size and typeface (Georgia or Verdana)
- Reading themes: White, Sepia, and Night mode
- Automatic reading position saving and restoration
- Bookmark pages with the dog-ear button
- Table of Contents panel
- Search within book
- Touch navigation (tap left/right edges to turn pages)
- Optional hardware volume button page turning
- Reading position sync across devices via WebDAV
- PWA install support (iOS Safari, desktop browsers) — works fully offline

## Installation

### As a PWA (iOS / Desktop)

1. Open the hosted URL in Safari (iOS) or Chrome/Edge (desktop)
2. **iOS**: tap the Share button then "Add to Home Screen"
3. **Desktop**: click the install icon in the address bar

Once installed, the app works fully offline.

### On webOS (HP TouchPad)

1. Download the latest `.ipk` from the App Museum: https://appcatalog.webosarchive.org/app/PapyruseReader
2. Install via webOS Quick Install or `palm-install`:
   ```bash
   palm-install com.palm.codepoet.papyrus_*.ipk
   ```

### From Source

```bash
# Clone the repository
git clone https://github.com/codepoet80/webos-papyrus-ereader.git
cd webos-papyrus-ereader

# Build and install (webOS)
palm-package app
palm-install com.palm.codepoet.papyrus_*.ipk
```

## Usage

1. Place ePub files on your TouchPad (any location works, but `/media/internal/ebooks/` is recommended)
2. Launch Papyrus
3. Tap the menu icon and select "Import ePub"
4. Select your ePub files from the document picker
5. Tap a book cover to start reading

### Reading Controls

- **Tap left edge** (30%) — Previous page
- **Tap right edge** (30%) — Next page
- **Tap center** (40%) — Toggle toolbar
- **Dog-ear icon** — Bookmark current page

### Settings

Access settings from the app menu to configure:

- **Basic Reading Mode** — disables page turn animations for faster navigation
- **Theme** — White, Sepia, or Night (black background)
- **Font size and typeface** — four sizes, Georgia or Verdana
- **Volume buttons turn pages** — use hardware volume keys to page forward/back while reading
- **Sync** — WebDAV URL, username, and password for cross-device position sync

### Reading Position Sync

Papyrus can sync your reading position across devices (webOS, iOS, desktop) using any WebDAV server — Nextcloud, ownCloud, a self-hosted nginx share, etc.

1. Open **Settings** from the app menu
2. Enable sync and enter your WebDAV URL, username, and password
3. Tap **Test Connection** to verify
4. Use **Sync Now** from the app menu to push or pull your position manually

Sync uses the ePub's built-in unique identifier (ISBN or UUID) as the sync key when available, so the same book syncs correctly regardless of filename or device.

## Credits

Papyrus stands on the shoulders of two excellent webOS applications:

### Kindle Beta App
The beautiful Enyo-based user interface comes from Amazon's Kindle Beta app for webOS. While the original app required Amazon's proprietary backend services (which are no longer available), its thoughtful UI design lives on in Papyrus.

### pReader
The ePub parsing and rendering engine is adapted from pReader by mhw. This pure-JavaScript implementation handles:
- ePub/ZIP file parsing
- HTML content chunking and storage
- Page fitting and pagination
- Image extraction and display

pReader's open-source engine made it possible to replace the Kindle app's proprietary C++ rendering backend with a fully open solution.

## Technical Details

- **Framework**: Enyo 1.0 (webOS)
- **Storage**: WebSQL for book content, localStorage for library metadata and settings
- **Supported Format**: ePub (DRM-free)
- **Sync**: WebDAV (PUT/GET/MKCOL with Basic auth)
- **Platforms**: HP TouchPad (webOS), iOS Safari (PWA), modern desktop browsers (PWA)

## Known Limitations

- DRM-protected ePubs are not supported
- Some complex ePub layouts may not render perfectly
- Phone/narrow-browser layout (less than 500px wide) has a known panel-selection issue — the library panel may remain visible instead of the reader panel on first load

## License

This project combines code from multiple sources. Please refer to the original licenses of the Kindle Beta app UI components and pReader engine.

## Contributing

Contributions are welcome! This project is maintained for the webOS homebrew community.

---

*Keeping webOS alive, one app at a time.*
