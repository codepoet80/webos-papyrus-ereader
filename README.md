# Papyrus

A modern ePub reader for webOS, built for the HP TouchPad.

Papyrus combines the polished Enyo UI of the Kindle Beta app with the pure-JavaScript ePub rendering engine from pReader, creating a fully functional open-source e-reader that doesn't depend on proprietary services.

## Features

- Clean, intuitive reading interface
- Import ePub files from your device
- Adjustable font size and typeface (Georgia or Verdana)
- Reading themes: White, Sepia, and Night mode
- Automatic reading position saving
- Bookmark pages with the dog-ear button
- Multi-select file import
- Touch navigation (tap left/right edges to turn pages)

## Installation

### From Package

1. Download the latest `.ipk` from the releases
2. Install via webOS Quick Install or `palm-install`:
   ```bash
   palm-install com.palm.codepoet.papyrus_*.ipk
   ```

### From Source

```bash
# Clone the repository
git clone https://github.com/codepoet80/webos-papyrus-ereader.git
cd webos-papyrus-ereader

# Build and install
palm-package com.palm.codepoet.papyrus
palm-install com.palm.codepoet.papyrus_*.ipk
```

## Usage

1. Place ePub files on your TouchPad (any location works, but `/media/internal/ebooks/` is recommended)
2. Launch Papyrus
3. Tap the menu icon and select "Import ePub"
4. Select your ePub files from the document picker
5. Tap a book cover to start reading

### Reading Controls

- **Tap left edge** (30%) - Previous page
- **Tap right edge** (30%) - Next page
- **Tap center** (40%) - Toggle toolbar
- **Dog-ear icon** - Bookmark current page

### Settings

Access settings from the app menu to configure:
- Basic Reading Mode (disables page turn animations)
- Other display preferences

## Credits

Papyrus stands on the shoulders of two excellent webOS applications:

### Kindle Beta App
The beautiful Enyo-based user interface comes from Amazon's Kindle Beta app for webOS. While the original app required Amazon's proprietary backend services (which are no longer available), its thoughtful UI design lives on in Papyrus.

### pReader
The ePub parsing and rendering engine is adapted from [pReader](http://www.ohloh.net/p/preader) by mhw. This pure-JavaScript implementation handles:
- ePub/ZIP file parsing
- HTML content chunking and storage
- Page fitting and pagination
- Image extraction and display

pReader's open-source engine made it possible to replace the Kindle app's proprietary C++ rendering backend with a fully open solution.

## Technical Details

- **Framework**: Enyo 1.0 (webOS)
- **Storage**: WebSQL for book content, localStorage for library metadata and settings
- **Supported Format**: ePub (DRM-free)

## Known Limitations

- DRM-protected ePubs are not supported
- Some complex ePub layouts may not render perfectly
- The location slider is not yet functional

## License

This project combines code from multiple sources. Please refer to the original licenses of the Kindle Beta app UI components and pReader engine.

## Contributing

Contributions are welcome! This project is maintained for the webOS homebrew community.

---

*Keeping webOS alive, one app at a time.*
