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
		{kind: "Helpers.Updater", name: "myUpdater"},

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
		{name: "aboutPopup", kind: "Popup", scrim: true, lazy: false, className: "aboutBox", style: "padding: 20px; text-align: center;", width: "300px", components: [
			{kind: "VFlexBox", align: "center", components: [
				{kind: "Image", src: "icon.png", style: "width: 64px; height: 64px; margin-bottom: 10px;"},
				{content: $L("Papyrus"), className: "aboutTitle"},
				{name: "versionText", content: "", className: "versText", style: "margin-bottom: 15px;"},
				{content: $L("Copyright 2026, codepoet"), style: "font-size: 14px; color: #666; margin-bottom: 15px;"},
				{kind: "Button", content: $L("OK"), className: "enyo-button-dark", onclick: "dismissAbout"}
			]},
		]},

		// Error popup
		{name: "errorPopup", kind: "Popup", style: "max-width:350px;", lazy: false, scrim: true, components: [
			{content: $L("An error has occurred."), className: "loginFormTitle", name: "errorTitle"},
			{content: $L("Please try again."), className: "loginFormDescription", name: "errorDescription"},
			{kind: "Button", content: $L("OK"), className: "enyo-button-dark", onclick: "dismissErr"}
		]},

		// Spinner popup for loading with progress text. Keep it non-modal: on
		// webOS 3, a modal/scrim popup can delay WebSQL work until it closes.
		{name: "spinnerPopup", kind: "Popup", className: "spinner-popup", lazy: false, dismissWithClick: false, modal: false, scrim: false, components: [
			{kind: "VFlexBox", align: "center", components: [
				{kind: "Spinner", name: "importSpinner", showing: true},
				{name: "spinnerText", content: "Loading...", style: "color: white; margin-top: 10px; font-size: 16px;"}
			]}
		]},

		// File picker for importing ePubs (multi-select enabled)
		{kind: "FilePicker", name: "filePicker", fileType: ["document"], allowMultiSelect: true, onPickFile: "handleFilePicked"},

		// Custom file picker popup (for use with filemgr service)
		{name: "epubPickerPopup", kind: "Popup", scrim: true, lazy: false, className: "settingsBox", width: "500px", style: "padding: 20px; height: 500px;", components: [
			{kind: "VFlexBox", style: "height: 100%;", components: [
				{content: $L("Select ePub Files"), className: "loginFormTitle"},
				{content: $L("Tap files to select them for import"), className: "loginFormDescription"},
				{kind: "Scroller", name: "epubPickerScroller", flex: 1, style: "height: 340px;", components: [
					{kind: "VFlexBox", components: [
						{kind: "RowGroup", name: "epubFileGroup", components: [
							{kind: "VirtualRepeater", name: "epubFileRepeater", onSetupRow: "setupEpubFileRow", components: [
								{kind: "Item", name: "epubFileItem", layoutKind: "HFlexLayout", align: "center", tapHighlight: true, onclick: "toggleEpubFileSelection", components: [
									{kind: "CheckBox", name: "epubFileCheckbox", onclick: "epubCheckboxClicked"},
									{kind: "VFlexBox", flex: 1, style: "margin-left: 10px; overflow: hidden;", components: [
										{name: "epubFileName", style: "font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"},
										{name: "epubFilePath", style: "font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"}
									]},
									{name: "epubFileSize", style: "color: #666; font-size: 14px; margin-left: 10px;"}
								]}
							]}
						]}
					]}
				]},
				{name: "epubPickerEmpty", content: $L("No ePub files found. Try placing .epub files in /media/internal/ebooks/"), className: "loginFormDescription", style: "text-align: center; padding: 40px 0;", showing: false},
				{kind: "HFlexBox", style: "margin-top: 10px;", components: [
					{kind: "Button", content: $L("Cancel"), flex: 1, className: "enyo-button-light", onclick: "cancelEpubPicker"},
					{kind: "Button", name: "importSelectedBtn", content: $L("Import Selected"), flex: 1, className: "enyo-button-dark", onclick: "importSelectedEpubs", disabled: true}
				]}
			]}
		]},

		// Palm services
		{name: "openBrowser", kind: enyo.PalmService, service: "palm://com.palm.applicationManager/", method: "launch"},
		{name: "DimService", kind: "PalmService", service: "palm://com.palm.display/control/"},
		{name: "listAppsService", kind: "PalmService", service: "palm://com.palm.applicationManager/", method: "listApps", onResponse: "handleListAppsResponse"},
		{name: "fileMgrService", kind: "PalmService", service: "palm://ca.canucksoftware.filemgr/", method: "listFiles", onResponse: "handleFileMgrResponse"},
		{name: "mediaRescanService", kind: "PalmService", service: "palm://com.palm.db/", method: "find"}
	],

	// Internal state
	library: null,
	configData: {},
	fileMgrAvailable: null,  // null = not checked, true/false = checked
	epubFilesFound: [],      // Files found by filemgr for custom picker
	epubFilesSelected: {},   // Map of selected file paths

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
					enyo.log("Migrating book '" + book.title + "': locationsTotal " + book.locationsTotal + " -> 10000");
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
				enyo.log("Library migration complete");
			}
		} catch (e) {
			enyo.log("Library migration error: " + e);
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
		this.$.myUpdater.CheckForUpdate("Papyrus eReader");
	},

	importMultipleBooks: function(filePaths) {
		var self = this;
		var index = 0;
		var total = filePaths.length;
		var importer = new FileImporter();

		// Show progress spinner immediately
		self.showImportProgress(1, total);

		var importNext = function() {
			if (index >= total) {
				// All done, hide spinner and refresh view
				self.hideImportProgress();
				if (self.$.navigator) {
					self.$.navigator.rebuildView();
				}
				return;
			}

			// Update progress text
			self.showImportProgress(index + 1, total);

			// Import directly using FileImporter (bypass importEpubFile to avoid spinner conflict)
			importer.importEpub(filePaths[index], function(book, error) {
				if (error) {
					self.log("Import error for " + filePaths[index] + ": " + error);
				} else if (book) {
					self.log("Successfully imported: " + book.title);
				}
				index++;
				// Small delay between imports to let UI update
				setTimeout(importNext, 100);
			});
		};

		importNext();
	},

	showImportProgress: function(current, total) {
		var text = "Importing books...";
		if (total > 0) {
			text = "Importing book " + current + " of " + total + "...";
		}
		this.log("showImportProgress: " + text);
		this.showSpinnerPopup(text);
	},

	hideImportProgress: function() {
		this.log("hideImportProgress");
		this.hideSpinnerPopup();
	},

	/**
	 * Show spinner popup with message
	 */
	showSpinnerPopup: function(message) {
		if (this.$.spinnerText) {
			this.$.spinnerText.setContent(message || "Loading...");
		}
		if (this.$.importSpinner) {
			this.$.importSpinner.show();
		}
		// Only call openAtCenter() once; subsequent calls just update the text.
		// Calling openAtCenter() every time re-triggers the open animation,
		// which resets the visible text instead of updating it.
		if (this.$.spinnerPopup && !this.spinnerPopupOpen) {
			this.spinnerPopupOpen = true;
			this.$.spinnerPopup.openAtCenter();
		}
	},

	/**
	 * Hide spinner popup
	 */
	hideSpinnerPopup: function() {
		this.spinnerPopupOpen = false;
		if (this.$.spinnerPopup) {
			this.$.spinnerPopup.close();
		}
		if (this.$.importSpinner) {
			this.$.importSpinner.hide();
		}
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
		// Read fresh settings from localStorage to avoid overwriting changes
		// made by Settings popup while this.configData was cached
		try {
			var freshSettings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			freshSettings[key] = value;
			this.configData = freshSettings;
			localStorage.setItem("ereader_settings", JSON.stringify(freshSettings));
		} catch (e) {
			this.configData[key] = value;
			this.saveSettings();
		}
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

		// Apply the user's screen timeout preference while reading
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
	 * Refresh library view (after clearing or changes)
	 */
	refreshLibrary: function() {
		this.log("Refreshing library...");
		// Rebuild the view
		if (this.$.navigator) {
			this.$.navigator.rebuildView();
		}
		// No auto-import - user must use "Import ePub" button
	},

	// ========================================
	// FILE IMPORT
	// ========================================

	showFilePicker: function() {
		// Check if filemgr is available (first time only)
		if (this.fileMgrAvailable === null) {
			this.checkForFileMgr();
		} else if (this.fileMgrAvailable) {
			this.showFileMgrPicker();
		} else {
			this.showFilePickerWithRescan();
		}
	},

	/**
	 * Check if ca.canucksoftware.filemgr is installed
	 */
	checkForFileMgr: function() {
		this.log("Checking for filemgr service...");
		if (window.PalmSystem && this.$.listAppsService) {
			this.$.listAppsService.call({});
		} else {
			// Not on device, use built-in picker
			this.fileMgrAvailable = false;
			this.$.filePicker.pickFile();
		}
	},

	/**
	 * Handle response from listApps service
	 */
	handleListAppsResponse: function(inSender, inResponse) {
		this.log("listApps response received");
		var found = false;

		if (inResponse && inResponse.apps) {
			for (var i = 0; i < inResponse.apps.length; i++) {
				if (inResponse.apps[i].id === "ca.canucksoftware.filemgr") {
					found = true;
					break;
				}
			}
		}

		this.fileMgrAvailable = found;
		this.log("filemgr available: " + found);

		if (found) {
			this.showFileMgrPicker();
		} else {
			this.showFilePickerWithRescan();
		}
	},

	/**
	 * Trigger media rescan and show built-in FilePicker
	 */
	showFilePickerWithRescan: function() {
		var self = this;
		this.log("Triggering media rescan before showing FilePicker...");

		// Trigger rescan of media database to pick up new files
		if (this.$.mediaRescanService) {
			try {
				this.$.mediaRescanService.call({
					query: {from: "com.palm.media.types:1"}
				});
			} catch (e) {
				this.log("Media rescan error: " + e);
			}
		}

		// Give the indexer a moment to process, then show picker
		setTimeout(function() {
			self.$.filePicker.pickFile();
		}, 500);
	},

	/**
	 * Use filemgr service to scan for ePub files
	 */
	showFileMgrPicker: function() {
		this.log("Using filemgr to scan for ePubs...");
		this.epubFilesFound = [];
		this.epubFilesSelected = {};
		this.directoriesScanned = 0;
		this.directoriesToScan = [
			"/media/internal",
			"/media/internal/ebooks",
			"/media/internal/books",
			"/media/internal/Documents",
			"/media/internal/downloads"
		];

		// Show spinner while scanning
		this.showSpinnerPopup("Scanning for ePub files...");

		// Start scanning directories
		this.scanNextDirectory();
	},

	/**
	 * Scan the next directory in the queue
	 */
	scanNextDirectory: function() {
		if (this.directoriesScanned >= this.directoriesToScan.length) {
			// Done scanning, show picker
			this.hideSpinnerPopup();
			this.showEpubPickerPopup();
			return;
		}

		var path = this.directoriesToScan[this.directoriesScanned];
		this.log("Scanning directory: " + path);

		if (this.$.fileMgrService) {
			this.$.fileMgrService.call({
				path: path,
				sort: "name",
				ascending: true
			});
		} else {
			// Service not available, skip to next
			this.directoriesScanned++;
			this.scanNextDirectory();
		}
	},

	/**
	 * Handle response from filemgr listFiles service
	 */
	handleFileMgrResponse: function(inSender, inResponse) {
		// Check for successful response with items
		if (inResponse && inResponse.returnValue !== false && inResponse.items) {
			for (var i = 0; i < inResponse.items.length; i++) {
				var item = inResponse.items[i];
				// Skip hidden files (starting with ".")
				if (item.name && item.name.charAt(0) === ".") {
					continue;
				}
				// Check if it's an epub file (by type or name)
				if (item.type === "epub" || (item.name && item.name.toLowerCase().indexOf(".epub") !== -1)) {
					// Check for duplicates (by path)
					var isDuplicate = false;
					for (var j = 0; j < this.epubFilesFound.length; j++) {
						if (this.epubFilesFound[j].path === item.path) {
							isDuplicate = true;
							break;
						}
					}
					if (!isDuplicate) {
						this.epubFilesFound.push({
							name: item.name,
							path: item.path,
							size: item.size || this.formatFileSize(item.bytes)
						});
					}
				}
			}
		} else if (inResponse && inResponse.returnValue === false) {
			// Directory doesn't exist or error - just log and continue
			this.log("Directory scan failed: " + (inResponse.errorText || "directory not found"));
		}

		// Continue to next directory
		this.directoriesScanned++;
		this.scanNextDirectory();
	},

	/**
	 * Format file size in human readable form
	 */
	formatFileSize: function(bytes) {
		if (!bytes) return "";
		if (bytes < 1024) return bytes + " B";
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
		return (bytes / (1024 * 1024)).toFixed(1) + " MB";
	},

	/**
	 * Show the custom epub picker popup
	 */
	showEpubPickerPopup: function() {
		this.log("Found " + this.epubFilesFound.length + " ePub files");

		if (this.epubFilesFound.length === 0) {
			this.$.epubPickerEmpty.setShowing(true);
			this.$.epubPickerScroller.setShowing(false);
			this.$.importSelectedBtn.setShowing(false);
		} else {
			this.$.epubPickerEmpty.setShowing(false);
			this.$.epubPickerScroller.setShowing(true);
			this.$.importSelectedBtn.setShowing(true);
			this.$.epubFileRepeater.render();
		}

		this.updateImportButtonState();
		this.$.epubPickerPopup.openAtCenter();
	},

	/**
	 * Setup row for epub file repeater
	 */
	setupEpubFileRow: function(inSender, inIndex) {
		if (inIndex < this.epubFilesFound.length) {
			var file = this.epubFilesFound[inIndex];
			this.$.epubFileName.setContent(file.name);
			// Show directory path (remove filename and /media/internal prefix for brevity)
			var dirPath = file.path.replace(/\/[^\/]+$/, "").replace("/media/internal", "");
			this.$.epubFilePath.setContent(dirPath || "/");
			this.$.epubFileSize.setContent(file.size);
			this.$.epubFileCheckbox.setChecked(!!this.epubFilesSelected[file.path]);
			return true;
		}
		return false;
	},

	/**
	 * Toggle selection when row is tapped
	 */
	toggleEpubFileSelection: function(inSender, inEvent) {
		var index = inEvent.rowIndex;
		if (index !== undefined && index < this.epubFilesFound.length) {
			var file = this.epubFilesFound[index];
			if (this.epubFilesSelected[file.path]) {
				delete this.epubFilesSelected[file.path];
			} else {
				this.epubFilesSelected[file.path] = true;
			}
			this.$.epubFileRepeater.renderRow(index);
			this.updateImportButtonState();
		}
	},

	/**
	 * Handle checkbox click (prevent double-toggle)
	 */
	epubCheckboxClicked: function(inSender, inEvent) {
		// Stop propagation to prevent toggleEpubFileSelection from also firing
		inEvent.stopPropagation();
		this.toggleEpubFileSelection(inSender, inEvent);
	},

	/**
	 * Update the import button enabled state
	 */
	updateImportButtonState: function() {
		var count = Object.keys(this.epubFilesSelected).length;
		this.$.importSelectedBtn.setDisabled(count === 0);
		if (count > 0) {
			this.$.importSelectedBtn.setContent("Import " + count + " Selected");
		} else {
			this.$.importSelectedBtn.setContent("Import Selected");
		}
	},

	/**
	 * Cancel the epub picker
	 */
	cancelEpubPicker: function() {
		this.$.epubPickerPopup.close();
	},

	/**
	 * Import selected epub files
	 */
	importSelectedEpubs: function() {
		var filePaths = Object.keys(this.epubFilesSelected);
		this.$.epubPickerPopup.close();

		if (filePaths.length > 0) {
			this.importMultipleEpubs(filePaths);
		}
	},

	handleFilePicked: function(inSender, inResponse) {
		this.log("FilePicker response: " + JSON.stringify(inResponse));

		// Collect all file paths from the response
		var allPaths = [];
		if (inResponse) {
			// FilePicker returns an array of selected files
			if (Array.isArray(inResponse) && inResponse.length > 0) {
				for (var i = 0; i < inResponse.length; i++) {
					var path = inResponse[i].fullPath || inResponse[i].path;
					if (path) {
						allPaths.push(path);
					}
				}
			} else if (inResponse.fullPath) {
				allPaths.push(inResponse.fullPath);
			} else if (inResponse.path) {
				allPaths.push(inResponse.path);
			} else if (typeof inResponse === "string") {
				allPaths.push(inResponse);
			} else if (inResponse.result && inResponse.result.fullPath) {
				allPaths.push(inResponse.result.fullPath);
			}
		}

		// Filter to only .epub files
		var filePaths = [];
		var skippedCount = 0;
		for (var i = 0; i < allPaths.length; i++) {
			if (allPaths[i].toLowerCase().indexOf(".epub") !== -1) {
				filePaths.push(allPaths[i]);
			} else {
				skippedCount++;
			}
		}

		if (filePaths.length > 0) {
			this.log("Importing " + filePaths.length + " ePub file(s)");
			if (skippedCount > 0) {
				this.log("Skipped " + skippedCount + " non-ePub file(s)");
			}
			this.importMultipleEpubs(filePaths);
		} else if (skippedCount > 0) {
			// User selected files but none were epubs
			this.showError("Import Error", "Please select ePub files only (.epub)");
		} else {
			this.log("No file paths in response");
		}
	},

	handleImportBook: function(inSender, filePath) {
		// If no file path provided, open the file picker
		if (!filePath) {
			this.showFilePicker();
		} else {
			this.importMultipleEpubs([filePath]);
		}
	},

	importMultipleEpubs: function(filePaths) {
		if (!filePaths || filePaths.length === 0) {
			return;
		}

		// Keep the screen on for the duration of the import.
		enyo.windows.setWindowProperties(window, {blockScreenTimeout: true});

		var self = this;
		var total = filePaths.length;
		var current = 0;
		var successCount = 0;
		var errors = [];

		function importNext() {
			if (current >= total) {
				// All done - restore normal screen timeout behavior.
				enyo.windows.setWindowProperties(window, {blockScreenTimeout: false});

				self.hideSpinnerPopup();

				// Refresh library view
				if (self.$.navigator) {
					self.$.navigator.rebuildView();
				}

				// Show summary if there were errors
				if (errors.length > 0) {
					self.showError("Import Complete",
						successCount + " book(s) imported successfully.\n" +
						errors.length + " failed.");
				} else {
					self.log("Successfully imported " + successCount + " book(s)");
				}
				return;
			}

			var filePath = filePaths[current];
			self.log("Importing: " + filePath);

			var importer = new FileImporter();
			var importCallbackFired = false;
			var importWatchdog = null;
			var lastSpinnerUpdate = 0;
			var lastImportPhase = "";
			var contentProcessingStarted = false;

			// Progress-aware watchdog: resets every time keepAlive(phase) is called.
			// DOM updates are throttled to once per second so the browser actually
			// gets a chance to repaint. Chunks fire faster than frames render on
			// the TouchPad, so without throttling the user never sees the updates.
			var keepAlive = function(phase) {
				if (importCallbackFired) return;
				lastImportPhase = phase || lastImportPhase;
				if (lastImportPhase.indexOf("Processing") >= 0 || lastImportPhase.indexOf("Encoding image") >= 0 || lastImportPhase.indexOf("Writing image") >= 0) {
					contentProcessingStarted = true;
				}
				var forceSpinnerUpdate = lastImportPhase.indexOf("Encoding image") >= 0 || lastImportPhase.indexOf("Writing image") >= 0;

				// Throttle DOM updates to once per second regardless of how fast
				// chunks fire, so each update is visible before the next one.
				var now = Date.now();
				var elapsed = now - lastSpinnerUpdate;
				if (forceSpinnerUpdate || elapsed >= 2000) {
					lastSpinnerUpdate = now;
					var msg = "Importing " + (current + 1) + " of " + total;
					var phaseStr = phase || "";
					msg += phaseStr ? (": " + phaseStr) : "...";
					self.showSpinnerPopup(msg);
				}

				clearTimeout(importWatchdog);
				var timeoutMs = contentProcessingStarted ? 300000 : 180000;
				importWatchdog = setTimeout(function() {
					if (!importCallbackFired) {
						if (contentProcessingStarted) {
							self.log("Import watchdog: still processing " + filePath + " (phase: " + (lastImportPhase || "content") + ")");
							lastSpinnerUpdate = 0;
							keepAlive(lastImportPhase || "Processing content...");
							return;
						}
						importCallbackFired = true;
						self.log("Import watchdog: no activity for " + Math.round(timeoutMs / 1000) + "s on " + filePath);
						errors.push(filePath + ": timed out");
						current++;
						enyo.windows.setWindowProperties(window, {blockScreenTimeout: false});
						self.hideSpinnerPopup();
						setTimeout(function() {
							self.showError("Import Error", "Import timed out. The file may be corrupt or too large.");
						}, 250);
					}
				}, timeoutMs);
			};
			keepAlive(); // arm the watchdog

			importer.importEpub(filePath, function(book, error) {
				if (importCallbackFired) return;
				importCallbackFired = true;
				clearTimeout(importWatchdog);

				if (error) {
					self.log("Import error for " + filePath + ": " + error);
					errors.push(filePath + ": " + error);
					enyo.windows.addBannerMessage("Import failed: " + filePath.split("/").pop(), "{}", "icon.png");
				} else if (book) {
					successCount++;
					self.log("Imported: " + book.title);
					enyo.windows.addBannerMessage("Imported: " + book.title, "{}", "icon.png");
				}

				current++;
				// Small delay between imports to let UI update
				setTimeout(importNext, 100);
			}, keepAlive);
		}

		importNext();
	},

	// Single file import (convenience wrapper)
	importEpubFile: function(filePath) {
		this.importMultipleEpubs([filePath]);
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

	isKeepScreenOnReadingEnabled: function() {
		try {
			var settings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			return settings.keepScreenOnReading === true;
		} catch (e) {
			this.log("Error reading screen timeout setting: " + e);
			return false;
		}
	},

	disableDim: function() {
		if (!this.isKeepScreenOnReadingEnabled()) {
			this.enableDim();
			return;
		}
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
