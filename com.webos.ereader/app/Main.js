/**
 * ereader.Main - Main application controller
 *
 * This is a simplified version of the Kindle app's Main.js that removes
 * all Amazon/KCF dependencies and focuses on local ePub file management.
 */
enyo.kind({
	name: "ereader.Main",
	kind: enyo.Control,
	className: "enyo-fit",
	published: {
		currentBook: null,
		storedSearchText: ""
	},
	components: [
		{kind: "ApplicationEvents", onWindowActivated: "windowActivatedHandler", onWindowDeactivated: "windowDeactivatedHandler", onWindowRotated: "handleWindowRotated"},

		// Toaster for slideout panels (TOC, search, markups)
		{kind: "Toaster", name: "toaster", scrim: true, flyInFrom: "right", style: "top:0px; bottom:0px; z-index:500;", lazy: false, onClose: "closeToaster", components: [
			{className: "enyo-sliding-view-shadow"},
			{kind: "VFlexBox", width: "600px", flex: 1, height: "100%", components: [
				{kind: "ereader.panels.SlideoutPanel", flex: 1, name: "slideoutContents", onSlidingDragBtnClicked: "handleSlideoutDismissal", onSearchResultSelected: "handleSearchResultSelected", onSearchQueried: "handleSearchQueried", onMarkupsResultSelected: "handleMarkupsResultSelected"},
				{kind: "Toolbar", components: [
					{kind: "GrabButton", onclick: "closeToaster"},
					{kind: "Spacer"}
				]}
			]}
		]},

		// Main pane - switches between library and reader views
		{kind: "Pane", transitionKind: "enyo.transitions.Simple", name: "mainPane", className: "enyo-fit", components: [
			{kind: "ereader.panels.MainPanels", name: "navigator", flex: 1, onBookSelected: "handleBookSelection", onImportBook: "handleImportBook"},
			{kind: "ereader.BookReader", name: "reader", onLibrarySelected: "handleLibrarySelection", onSlideOutSelected: "handleSlideoutSelection", onSearchQueried: "handleSearchQueried", onReaderReady: "handleReaderReady", onLocalPositionUpdated: "handleLocalPositionUpdated"}
		]},

		// Application menu
		{kind: "AppMenu", name: "appMenu", lazy: false, components: [
			{caption: $L("Import ePub"), onclick: "showFilePicker"},
			{caption: $L("Settings"), onclick: "showSettings"},
			{caption: $L("About"), onclick: "showAbout"}
		]},

		// Settings popup
		{kind: "ereader.userPreferences.Settings", name: "settingsPopup"},

		// About popup
		{name: "aboutPopup", kind: "Popup", scrim: true, className: "aboutBox", style: "padding: 20px 20px 20px 20px;text-align: center;", width: "350px", components: [
			{kind: "VFlexBox", components: [
				{content: $L("E-Reader"), className: "aboutTitle"},
				{name: "versionText", content: "", className: "versText"},
				{content: $L("An open-source ePub reader for webOS."), className: "loginFormDescription"},
				{content: $L("Based on Kindle UI and Preader rendering engine."), className: "loginFormDescription"},
				{kind: "Button", content: $L("OK"), className: "enyo-button-dark", onclick: "dismissAbout"}
			]},
		]},

		// Error popup
		{name: "errorPopup", kind: "Popup", style: "max-width:350px;", lazy: false, scrim: true, components: [
			{content: $L("An error has occurred."), className: "loginFormTitle", name: "errorTitle"},
			{content: $L("Please try again."), className: "loginFormDescription", name: "errorDescription"},
			{kind: "Button", content: $L("OK"), className: "enyo-button-dark", onclick: "dismissErr"}
		]},

		// Spinner popup for loading
		{name: "spinnerPopup", kind: "Popup", className: "spinner-popup", dismissWithClick: false, modal: true, scrim: true, components: [
			{kind: "SpinnerLarge"},
		]},

		// File picker for importing ePubs
		{kind: "FilePicker", name: "filePicker", fileType: ["document"], onPickFile: "handleFilePicked"},

		// Palm services
		{name: "openBrowser", kind: enyo.PalmService, service: "palm://com.palm.applicationManager/", method: "launch"},
		{name: "DimService", kind: "PalmService", service: "palm://com.palm.display/control/"}
	],

	// Internal state
	library: null,
	configData: {},

	create: function() {
		this.inherited(arguments);

		this.currentBook = null;
		this.currentBookChanged();
		this.storedSearchText = "";
		this.storedSearchTextChanged();

		enyo.keyboard.setResizesWindow(false);

		// Migrate old library data (fix locationsTotal scale)
		this.migrateLibraryData();

		// Initialize the library
		this.library = new Library("ereader_lib", enyo.bind(this, "libraryLoaded"));

		// Set up global reference
		window.EReaderApp = this;

		// Load saved settings
		this.loadSettings();
	},

	/**
	 * Migrate old library data to fix locationsTotal scale issue.
	 * Old imports stored byte length instead of normalized 0-10000 scale.
	 */
	migrateLibraryData: function() {
		try {
			var libraryJson = localStorage.getItem("ereader_library");
			if (!libraryJson) return;

			var library = JSON.parse(libraryJson);
			var migrated = false;

			for (var i = 0; i < library.length; i++) {
				var book = library[i];
				// If locationsTotal > 10000, it's using the old byte-length scale
				if (book.locationsTotal && book.locationsTotal > 10000) {
					console.log("Migrating book '" + book.title + "': locationsTotal " + book.locationsTotal + " -> 10000");
					// Convert locationsCompleted from byte position to 0-10000 scale
					if (book.locationsCompleted && book.locationsCompleted > 0) {
						var oldPercent = book.locationsCompleted / book.locationsTotal;
						book.locationsCompleted = Math.floor(oldPercent * 10000);
					}
					book.locationsTotal = 10000;
					migrated = true;
				}
			}

			if (migrated) {
				localStorage.setItem("ereader_library", JSON.stringify(library));
				console.log("Library migration complete");
			}
		} catch (e) {
			console.log("Library migration error: " + e);
		}
	},

	rendered: function() {
		this.inherited(arguments);
		// Start on the library view
		this.$.mainPane.selectViewByName("navigator", true);
	},

	// ========================================
	// LIBRARY INITIALIZATION
	// ========================================

	libraryLoaded: function(library) {
		this.log("Library loaded with " + library.entries.length + " books");
		// Refresh library view if navigator is ready
		if (this.$.navigator) {
			this.$.navigator.rebuildView();
		}
		// Auto-scan for new ePub files
		this.scanForNewBooks();
	},

	scanForNewBooks: function() {
		var self = this;
		var importer = new FileImporter();

		// Known ePub files to check (for testing)
		var knownFiles = [
			"/media/internal/ebooks/Accelerando.epub",
			"/media/internal/ebooks/AnneFrankDiary.epub",
			"/media/internal/ebooks/CatcherInTheRye.epub",
			"/media/internal/ebooks/DemonHauntedWorld.epub"
		];

		// Get existing book paths to avoid re-importing
		var existingPaths = {};
		try {
			var libraryJson = localStorage.getItem("ereader_library");
			var library = libraryJson ? JSON.parse(libraryJson) : [];
			for (var i = 0; i < library.length; i++) {
				if (library[i].bookFilePath) {
					existingPaths[library[i].bookFilePath] = true;
				}
			}
		} catch (e) {}

		// Filter out already imported files
		var newFiles = [];
		for (var i = 0; i < knownFiles.length; i++) {
			if (!existingPaths[knownFiles[i]]) {
				newFiles.push(knownFiles[i]);
			}
		}

		if (newFiles.length > 0) {
			self.log("Found " + newFiles.length + " new ePub files to import");
			self.importMultipleBooks(newFiles);
		} else {
			self.log("No new ePub files to import");
		}
	},

	// DEBUG: Auto-open first book and page forward for testing
	debugAutoOpenBook: function() {
		var self = this;
		self.log("DEBUG: Auto-opening first book for testing");

		// Get library from localStorage
		try {
			var libraryJson = localStorage.getItem("ereader_library");
			var library = libraryJson ? JSON.parse(libraryJson) : [];

			if (library.length > 0) {
				// Find a specific book for testing (change this to test different books)
				var testBookTitle = "Accelerando"; // Test Accelerando
				var bookIndex = 0;
				for (var i = 0; i < library.length; i++) {
					if (library[i].title && library[i].title.indexOf(testBookTitle) !== -1) {
						bookIndex = i;
						break;
					}
				}
				var bookData = new BookData(library[bookIndex]);
				self.log("DEBUG: Opening book: " + bookData.title + " (dbName: " + bookData.bookDbName + ")");

				// Wait a moment for UI to settle, then open
				setTimeout(function() {
					self.selectBook(bookData);

					// After book opens, wait for it to be ready, then auto-page
					setTimeout(function() {
						self.debugAutoPage(5);
					}, 3000);
				}, 1000);
			} else {
				self.log("DEBUG: No books in library to auto-open");
			}
		} catch (e) {
			self.log("DEBUG: Error auto-opening book: " + e);
		}
	},

	// DEBUG: Auto-page forward N times
	debugAutoPage: function(count) {
		var self = this;
		var pagesAdvanced = 0;

		self.log("DEBUG: Starting auto-page test, will advance " + count + " pages");

		var pageNext = function() {
			if (pagesAdvanced >= count) {
				self.log("DEBUG: Auto-page test complete. Advanced " + pagesAdvanced + " pages.");
				return;
			}

			pagesAdvanced++;
			self.log("DEBUG: Advancing to page " + pagesAdvanced + " of " + count);

			// Call nextPage on the reader's body component
			if (self.$.reader && self.$.reader.$.body && self.$.reader.$.body.$.epubRenderer) {
				self.$.reader.$.body.$.epubRenderer.nextPage();
			} else {
				self.log("DEBUG: Cannot find epubRenderer for paging");
				return;
			}

			// Wait between pages
			setTimeout(pageNext, 500);
		};

		pageNext();
	},

	importMultipleBooks: function(filePaths) {
		var self = this;
		var index = 0;

		var importNext = function() {
			if (index >= filePaths.length) {
				// All done, refresh view
				if (self.$.navigator) {
					self.$.navigator.rebuildView();
				}
				return;
			}

			self.importEpubFile(filePaths[index]);
			index++;
			// Small delay between imports
			setTimeout(importNext, 500);
		};

		importNext();
	},

	// ========================================
	// SETTINGS MANAGEMENT
	// ========================================

	loadSettings: function() {
		// Load settings from localStorage
		try {
			var savedSettings = localStorage.getItem("ereader_settings");
			if (savedSettings) {
				this.configData = JSON.parse(savedSettings);
			} else {
				this.configData = this.getDefaultSettings();
				this.saveSettings();
			}
		} catch (e) {
			this.configData = this.getDefaultSettings();
		}

		// Apply settings
		this.applySettings();
	},

	saveSettings: function() {
		try {
			localStorage.setItem("ereader_settings", JSON.stringify(this.configData));
		} catch (e) {
			this.log("Failed to save settings: " + e);
		}
	},

	getDefaultSettings: function() {
		return {
			settingAnimation: false,
			currentAppView: "library",
			currentBook: null,
			currentContentView: "ereader.contentContainer.GridViewItem",
			currentContentSort: "lastAccessed",
			currentFontType: 0,
			currentFontSize: 20,
			currentTheme: 0
		};
	},

	applySettings: function() {
		// Apply content view type
		if (this.$.navigator && this.configData.currentContentView) {
			this.$.navigator.selectContentViewType(this.configData.currentContentView);
		}

		// Apply animation setting
		if (this.$.reader && this.configData.settingAnimation !== undefined) {
			this.$.reader.setAnimationConfig(this.configData.settingAnimation);
		}

		// Apply content sort
		if (this.$.navigator && this.configData.currentContentSort) {
			this.$.navigator.selectContentSort(this.configData.currentContentSort);
		}

		// Apply font settings to reader
		if (this.$.reader) {
			this.$.reader.selectInitialFontType(this.configData.currentFontType || 0);
			this.$.reader.selectInitialFontSize(this.configData.currentFontSize || 20);
			this.$.reader.selectInitialTheme(this.configData.currentTheme || 0);
		}
	},

	updateSetting: function(key, value) {
		this.configData[key] = value;
		this.saveSettings();
	},

	// ========================================
	// BOOK SELECTION AND NAVIGATION
	// ========================================

	handleBookSelection: function(inSender, book) {
		this.log("Book selected: " + book.title);
		this.selectBook(book);
	},

	selectBook: function(book) {
		if (!book || !book.bookFilePath) {
			this.showError("Invalid book", "The selected book cannot be opened.");
			return;
		}

		this.currentBook = book;
		this.currentBookChanged();

		// Update last accessed time
		book.lastAccessed = Date.now();

		// Save current book to settings
		this.updateSetting("currentBook", {
			asin: book.asin,
			title: book.title
		});
		this.updateSetting("currentAppView", "reader");

		// Switch to reader view
		this.$.mainPane.selectViewByName("reader", true);

		// Open the book in the reader
		this.$.reader.openBook(book);

		// Disable screen dimming while reading
		this.disableDim();
	},

	handleLibrarySelection: function() {
		this.log("Returning to library");

		// Save reading position if we have a current book
		if (this.currentBook) {
			this.saveReadingPosition();
		}

		this.currentBook = null;
		this.currentBookChanged();

		this.updateSetting("currentAppView", "library");

		// Switch to library view
		this.$.mainPane.selectViewByName("navigator", true);

		// Re-enable screen dimming
		this.enableDim();

		// Refresh library view
		if (this.$.navigator) {
			this.$.navigator.rebuildView();
		}
	},

	saveReadingPosition: function() {
		if (this.currentBook && this.$.reader) {
			var position = this.$.reader.getCurrentPosition();
			if (position !== undefined) {
				this.currentBook.locationsCompleted = position;
				this.currentBook.lastAccessed = Date.now();
				// Save to localStorage
				this.updateBookInLibrary(this.currentBook);
			}
		}
	},

	updateBookInLibrary: function(book) {
		try {
			var libraryJson = localStorage.getItem("ereader_library");
			var library = libraryJson ? JSON.parse(libraryJson) : [];

			// Find and update the book
			for (var i = 0; i < library.length; i++) {
				if (library[i].asin === book.asin) {
					library[i].locationsCompleted = book.locationsCompleted;
					library[i].lastAccessed = book.lastAccessed;
					break;
				}
			}

			localStorage.setItem("ereader_library", JSON.stringify(library));
		} catch (e) {
			this.log("Failed to save reading position: " + e);
		}
	},

	/**
	 * Refresh library after clearing - rescans and reimports books
	 */
	refreshLibrary: function() {
		this.log("Refreshing library...");
		// Rebuild the view (will show empty)
		if (this.$.navigator) {
			this.$.navigator.rebuildView();
		}
		// Rescan for books to import
		this.scanForNewBooks();
	},

	// ========================================
	// FILE IMPORT
	// ========================================

	showFilePicker: function() {
		this.$.filePicker.pickFile();
	},

	handleFilePicked: function(inSender, inResponse) {
		if (inResponse && inResponse.fullPath) {
			this.importEpubFile(inResponse.fullPath);
		}
	},

	handleImportBook: function(inSender, filePath) {
		this.importEpubFile(filePath);
	},

	importEpubFile: function(filePath) {
		this.log("Importing ePub: " + filePath);

		// Show spinner
		this.$.spinnerPopup.openAtCenter();

		var self = this;

		// Use FileImporter to import the ePub
		// FileImporter handles storage to localStorage
		var importer = new FileImporter();
		importer.importEpub(filePath, function(book, error) {
			self.$.spinnerPopup.close();

			if (error) {
				self.log("Import error: " + error);
				self.showError("Import Failed", error);
				return;
			}

			if (book) {
				// Refresh library view (FileImporter already saved to localStorage)
				if (self.$.navigator) {
					self.$.navigator.rebuildView();
				}

				self.log("Successfully imported: " + book.title);
			}
		});
	},

	// ========================================
	// SLIDEOUT PANEL (TOC, SEARCH, MARKUPS)
	// ========================================

	handleSlideoutSelection: function(inSender, view) {
		this.showToaster(view);
	},

	showToaster: function(view) {
		if (this.$.slideoutContents) {
			this.$.slideoutContents.selectView(view);

			if (this.currentBook) {
				this.$.slideoutContents.setCurrentBook(this.currentBook);
			}
		}
		this.$.toaster.open();
	},

	closeToaster: function() {
		this.$.toaster.close();
	},

	handleSlideoutDismissal: function() {
		this.closeToaster();
	},

	handleSearchResultSelected: function(inSender, result) {
		this.closeToaster();
		if (this.$.reader && result && result.location) {
			this.$.reader.goToLocation(result.location);
		}
	},

	handleSearchQueried: function(inSender, searchText) {
		this.storedSearchText = searchText;
		this.storedSearchTextChanged();
	},

	handleMarkupsResultSelected: function(inSender, result) {
		this.closeToaster();
		if (this.$.reader && result && result.position) {
			this.$.reader.goToPosition(result.position);
		}
	},

	// ========================================
	// READER EVENTS
	// ========================================

	handleReaderReady: function() {
		this.log("Reader is ready");
	},

	handleLocalPositionUpdated: function(inSender, position) {
		// Save reading position periodically
		if (this.currentBook) {
			this.currentBook.locationsCompleted = position;
		}
	},

	// ========================================
	// UI HELPERS
	// ========================================

	showSettings: function() {
		if (this.$.settingsPopup) {
			this.$.settingsPopup.openAtCenter();
		}
	},

	showAbout: function() {
		var version = "1.0.0";
		try {
			var appInfo = enyo.fetchAppInfo();
			if (appInfo && appInfo.version) {
				version = appInfo.version;
			}
		} catch (e) {}

		this.$.versionText.setContent($L("Version: ") + version);
		this.$.aboutPopup.openAtCenter();
	},

	dismissAbout: function() {
		this.$.aboutPopup.close();
	},

	showError: function(title, message) {
		this.$.errorTitle.setContent(title || $L("Error"));
		this.$.errorDescription.setContent(message || $L("An error occurred."));
		this.$.errorPopup.openAtCenter();
	},

	dismissErr: function() {
		this.$.errorPopup.close();
	},

	// ========================================
	// WINDOW EVENTS
	// ========================================

	windowActivatedHandler: function() {
		this.log("Window activated");
		if (this.$.reader && this.currentBook) {
			this.disableDim();
		}
	},

	windowDeactivatedHandler: function() {
		this.log("Window deactivated");
		this.enableDim();
		// Save reading position when app is deactivated
		this.saveReadingPosition();
	},

	handleWindowRotated: function() {
		if (this.$.reader) {
			this.$.reader.handleWindowRotated();
		}
	},

	// ========================================
	// SCREEN DIMMING
	// ========================================

	disableDim: function() {
		if (window.PalmSystem && this.$.DimService) {
			try {
				this.$.DimService.call({blockScreenTimeout: true});
			} catch (e) {
				this.log("Error disabling dim: " + e);
			}
		}
	},

	enableDim: function() {
		if (window.PalmSystem && this.$.DimService) {
			try {
				this.$.DimService.call({blockScreenTimeout: false});
			} catch (e) {
				this.log("Error enabling dim: " + e);
			}
		}
	},

	// ========================================
	// APP RELAUNCH
	// ========================================

	relaunchHandler: function(params) {
		this.log("App relaunched with params: " + JSON.stringify(params));

		if (params && params.target) {
			// Handle opening an ePub file directly
			if (params.target.indexOf(".epub") !== -1) {
				this.importEpubFile(params.target);
			}
		}
	},

	// ========================================
	// UTILITY
	// ========================================

	currentBookChanged: function() {
		// Update slideout panel with current book
		if (this.$.slideoutContents && this.currentBook) {
			this.$.slideoutContents.setCurrentBook(this.currentBook);
		}
	},

	storedSearchTextChanged: function() {
		// Sync search text between views
	},

	blank: function() {
		// Empty callback
	}
});
