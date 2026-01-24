enyo.depends(
	// Mojo compatibility shim (must load first)
	"src/MojoCompat.js",

	// Preader rendering engine - core IO
	"src/io/Bytes.js",
	"src/io/ByteReader.js",
	"src/io/File.js",
	"src/io/BitBuffer.js",
	"src/io/PackedBytes.js",
	"src/io/text2html.js",
	"src/io/Database.js",

	// Preader rendering engine - compression
	"src/io/Compression/Inflate.js",
	"src/io/Compression/Deflate.js",
	"src/io/Compression/zlib.js",
	"src/io/Compression/lz77.js",
	"src/io/Compression/huffcdic.js",
	"src/io/Compression/ZipFile.js",

	// Preader rendering engine - encryption (for DRM check)
	"src/encryption/des.js",
	"src/encryption/crc32.js",
	"src/encryption/sha1.js",
	"src/encryption/pc1.js",

	// Preader rendering engine - PDB/ePub parsing
	"src/pdb/PDBRecordInfo.js",
	"src/pdb/PDBFile.js",
	"src/pdb/DocRecord.js",
	"src/pdb/DocReader.js",
	"src/pdb/EpubReader.js",
	"src/pdb/HtmlReader.js",

	// Preader rendering engine - encodings
	"src/encodings/utf8.js",
	"src/encodings/windows1252.js",
	"src/encodings/encodingList.js",

	// Preader rendering engine - display
	"src/display/HTMLBuffer.js",
	"src/display/HTMLBook.js",
	"src/display/HTMLParser.js",
	"src/display/PageFitter.js",

	// Preader rendering engine - library
	"src/library/Library.js",
	"src/library/LibraryEntry.js",

	// Application - Common utilities (load first)
	"app/common/Math.uuid.js",
	"app/common/ThrottledTimeout.js",
	"app/common/BookData.js",
	"app/common/EpubRenderer.js",
	"app/common/FileImporter.js",
	"app/common/ExpandingSearchBox.js",
	"app/common/common.css",

	// Application - Content container (library views)
	"app/contentContainer/ViewBase.js",
	"app/contentContainer/ListView.js",
	"app/contentContainer/GridView.js",
	"app/contentContainer/ContentNavigator.js",
	"app/contentContainer/ItemMenuPopup.js",
	"app/contentContainer/BookItems.css",

	// Application - Library navigator
	"app/libraryNavigator/LibraryNavigator.js",
	"app/libraryNavigator/LibraryNavigator.css",

	// Application - Panels
	"app/panels/KindlePanels.js",
	"app/panels/SlideoutPanel.js",
	"app/panels/panels.css",

	// Application - Reading
	"app/reading/DogEarButton.js",
	"app/reading/FontBox.js",
	"app/reading/BrightnessBox.js",
	"app/reading/BookInfoPopup.js",
	"app/reading/top_row.js",
	"app/reading/bottom_row.js",
	"app/reading/body.js",
	"app/reading/BookReader.js",
	"app/reading/BookReader.css",

	// Application - User preferences
	"app/userPreferences/Settings.js",
	"app/userPreferences/UserSettings.css",

	// Application - Main (load last)
	"app/Main.js",
	"app/Main.css"
);
