/**
 * ereader.BookReader - Book reader view
 *
 * Simplified version that removes MojoDB and Amazon dependencies.
 */
enyo.kind({
	name: "ereader.BookReader",
	kind: "Control",
	events: {
		onLibrarySelected: "",
		onSlideOutSelected: "",
		onSearchQueried: "",
		onReaderReady: "",
		onLocalPositionUpdated: ""
	},
	className: "book-reader-main white",
	components: [
		// Volume keys service for page turning with hardware buttons (optional feature)
		{name: "volumeKeysService", kind: "PalmService",
		 service: "palm://com.palm.keys/audio/", method: "status",
		 subscribe: true, onSuccess: "handleVolumeKey", onFailure: "handleVolumeKeyError"},

		{name: "top_row", kind: "ereader.top_row", className: "top-row-controls", onPageManipulation: "doPageManipulation", onLibrarySelected: "handleLibrarySelected", onSearchQueried: "handleSearchQueried", onBrightnessChanged: "handleBrightnessChanged", showing: false, onTypeSelection: "handleTypeSelection", onFontSizeChanged: "handleFontSizeChanged", onReaderThemeChanged: "handleReaderThemeChanged", onclick: "setHideOnceOne", onSearchBoxCollapsed: "setHideOnceTwo"},
		{kind: "ereader.reading.DogEarButton", name: "readerDogear", onclick: "handleDogear", className: "reader-dogear", showing: false},
		{name: "body", kind: "ereader.body", onmousedown: "handleMouseDown", style: "position: absolute; top: 0px; left: 0px; z-index: 50; width: 100%; height: 100%;", onTocAvailableChanged: "handleTocAvailableChanged", onPluginReady: "handlePluginReady", onBookmarkUpdated: "updateBookmarks", onLocationChanged: "handleLocationChanged", onShowOverlays: "showOverlays", onPluginStarted: "handlePluginStarted", onNotesShowingChanged: "handleNoteShowingChanged", onEndOfBook: "handleEndOfBook"},
		{name: "bottom_row", kind: "ereader.bottom_row", className: "bottom-row-controls", onSlideOutSelected: "handleSlideOutSelected", onclick: "setHideOnceOne", showing: false, onLocationSelected: "handleLocationSelected", onTOCSelected: "handleTOCSelected", onPreviousLocationSelected: "handlePrevLocSelected"},
		{name: "dimCover", className: "dimCover", onclick: "handleDismissSlideout", showing: false},
		{name: "loadingPopup", kind: "Popup", className: "spinner-popup", lazy: false, scrim: true, modal: true, components: [
			{kind: "VFlexBox", align: "center", components: [
				{kind: "Spinner", showing: true},
				{content: "Loading book...", style: "color: white; margin-top: 10px;"}
			]}
		]}
	],

	pluginReady: false,
	pluginStarted: false,
	bookData: null,
	volumeKeysActive: false,

	create: function() {
		this.inherited(arguments);
		console.log("BookReader: create() - Volume key page turning available (check settings to enable)");
	},

	// ========================================
	// VOLUME KEY HANDLING FOR PAGE TURNING
	// ========================================

	/**
	 * Check if volume key page turning is enabled in settings.
	 */
	isVolumeKeyPageTurnEnabled: function() {
		try {
			var settings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			return settings.volumeKeyPageTurn === true;
		} catch (e) {
			return false;
		}
	},

	/**
	 * Start listening for volume key events.
	 * Called when book is ready for reading, only if feature is enabled.
	 */
	startVolumeKeyListener: function() {
		// Check if feature is enabled in settings
		if (!this.isVolumeKeyPageTurnEnabled()) {
			console.log("BookReader: Volume key page turning is disabled in settings");
			return;
		}

		console.log("BookReader: startVolumeKeyListener() called");
		if (this.volumeKeysActive) {
			console.log("BookReader: Volume keys already active, skipping");
			return;
		}

		try {
			console.log("BookReader: Calling volumeKeysService.call()");
			this.$.volumeKeysService.call({subscribe: true});
			this.volumeKeysActive = true;
			console.log("BookReader: Volume key subscription started successfully");
		} catch (e) {
			console.error("BookReader: Failed to start volume key listener: " + e);
		}
	},

	/**
	 * Stop listening for volume key events.
	 * Called when leaving reader view.
	 */
	stopVolumeKeyListener: function() {
		console.log("BookReader: stopVolumeKeyListener() called");
		if (!this.volumeKeysActive) {
			console.log("BookReader: Volume keys not active, skipping");
			return;
		}

		try {
			console.log("BookReader: Cancelling volumeKeysService subscription");
			this.$.volumeKeysService.cancel();
			this.volumeKeysActive = false;
			console.log("BookReader: Volume key subscription stopped successfully");
		} catch (e) {
			console.error("BookReader: Failed to stop volume key listener: " + e);
		}
	},

	/**
	 * Handle errors from volume key service.
	 */
	handleVolumeKeyError: function(inSender, inError) {
		console.error("BookReader: Volume key service error: " + JSON.stringify(inError));
		this.volumeKeysActive = false;
	},

	/**
	 * Handle volume key events from palm://com.palm.keys/audio service.
	 * Volume Up = Next Page, Volume Down = Previous Page
	 */
	handleVolumeKey: function(inSender, inResponse) {
		console.log("BookReader: handleVolumeKey() - Raw response: " + JSON.stringify(inResponse));

		if (!this.pluginReady) {
			console.log("BookReader: Plugin not ready, ignoring volume key");
			return;
		}

		// The service returns: {key: "volume_up"|"volume_down", state: "down"|"up"}
		var key = inResponse.key;
		var state = inResponse.state;

		console.log("BookReader: Volume key event - key: " + key + ", state: " + state);

		// Only respond to key down events (not key up)
		if (state !== "down") {
			console.log("BookReader: Ignoring key up event");
			return;
		}

		// Hide overlays if showing before turning page
		if (this.overlaysShowing) {
			console.log("BookReader: Hiding overlays before page turn");
			this.hideOverlays();
		}

		if (key === "volume_up") {
			console.log("BookReader: Volume UP pressed - turning to NEXT page");
			this.$.body.nextPage();
		} else if (key === "volume_down") {
			console.log("BookReader: Volume DOWN pressed - turning to PREVIOUS page");
			this.$.body.previousPage();
		} else {
			console.log("BookReader: Unknown volume key: " + key);
		}
	},

	doPageManipulation: function(inSender, action) {
		this.$.body.doChangePage(action);
	},

	handleSearchQueried: function(inSender, searchText) {
		this.doSearchQueried(searchText);
	},

	handleSlideOutSelected: function(inSender, show) {
		this.doSlideOutSelected(show);
	},

	handleDismissSlideout: function() {
		this.owner.handleSlideoutDismissal();
	},

	handleLibrarySelected: function() {
		this.log("BookReader: handleLibrarySelected called");

		// Stop listening for volume key events
		console.log("BookReader: handleLibrarySelected - Stopping volume key listener");
		this.stopVolumeKeyListener();

		if (this.pluginReady) {
			this.saveReadingPosition();
		}
		this.pluginStarted = false;
		this.pluginReady = false;
		this.$.readerDogear.hide();
		this.$.readerDogear.toggle(false);
		this.$.body.closePopups();
		this.$.body.clearNotes();
		this.log("BookReader: firing doLibrarySelected");
		this.doLibrarySelected();
	},

	openBook: function(bookData) {
		this.log(JSON.stringify(bookData));
		this.bookData = bookData;

		// Show loading spinner
		this.$.loadingPopup.openAtCenter();

		this.$.top_row.$.bookTitle.setContent(bookData.title);
		this.$.bottom_row.setTotalLocations(bookData.locationsTotal || 10000);
		this.$.bottom_row.setLocationInfo(bookData.locationsCompleted || 0);
		this.$.bottom_row.setShowing(false);
		this.$.top_row.setShowing(false);
		this.$.body.currentBook = bookData;
		this.disableHistoryBack();

		// Initialize the book in the body component
		this.$.body.initializeWithBook(bookData);
	},

	handlePluginReady: function() {
		this.log();
		// Hide loading spinner
		this.$.loadingPopup.close();

		this.pluginReady = true;
		this.overlaysShowing = false;
		this.showOverlays();
		this.doReaderReady();

		// Start listening for volume key events for page turning
		console.log("BookReader: handlePluginReady - Starting volume key listener");
		this.startVolumeKeyListener();
	},

	handlePluginStarted: function() {
		this.pluginStarted = true;
	},

	handleTocAvailableChanged: function(inSender, available) {
		this.$.bottom_row.setTocAvailable(available);
	},

	handleLocationChanged: function(inSender, locStart, locEnd, totalLoc, posStart, posEnd) {
		this.currentLocStart = locStart;
		this.currentLocEnd = locEnd;
		this.currentPosStart = posStart;
		this.currentPosEnd = posEnd;

		this.$.bottom_row.setLocationInfo(locStart);
		this.doLocalPositionUpdated(locStart);
	},

	showOverlays: function(inSender, hideOnce) {
		if (!this.pluginReady) return;

		if (this.overlaysShowing && !hideOnce) {
			this.hideOverlays();
		} else if (!this.hideOnce) {
			this.overlaysShowing = true;
			this.$.top_row.show();
			this.$.bottom_row.show();
			this.$.readerDogear.show();
			this.$.body.overlayStateChange("showing");
		}
		this.hideOnce = false;
	},

	hideOverlays: function() {
		this.overlaysShowing = false;
		this.$.top_row.hide();
		this.$.bottom_row.hide();
		this.$.readerDogear.hide();
		this.$.body.overlayStateChange("hidden");
	},

	setHideOnceOne: function() {
		this.hideOnce = true;
	},

	setHideOnceTwo: function() {
		this.hideOnce = true;
		this.showOverlays();
	},

	handleDogear: function() {
		this.$.body.toggleBookmark();
	},

	updateBookmarks: function(inSender, hasBookmark) {
		this.$.readerDogear.toggle(hasBookmark);
	},

	handleLocationSelected: function(inSender, location) {
		this.$.body.goToLocation(location);
	},

	handleTOCSelected: function() {
		this.$.body.goToTableOfContents();
	},

	handlePrevLocSelected: function() {
		this.$.body.historyBack();
	},

	handleTypeSelection: function(inSender, type) {
		this.$.body.setFontType(type);
		this.saveFontSetting("currentFontType", type);
	},

	handleFontSizeChanged: function(inSender, size) {
		this.$.body.setFontSize(size);
		this.saveFontSetting("currentFontSize", size);
	},

	handleReaderThemeChanged: function(inSender, theme) {
		this.$.body.setThemeColor(theme);
		this.saveFontSetting("currentTheme", theme);
		this.updateThemeClass(theme);
	},

	updateThemeClass: function(theme) {
		this.removeClass("white");
		this.removeClass("sepia");
		this.removeClass("black");

		var themeClass = "white";
		if (theme === 1) themeClass = "sepia";
		else if (theme === 2) themeClass = "black";

		this.addClass(themeClass);
		this.$.body.changeCSSClassesTo(themeClass);
	},

	handleBrightnessChanged: function(inSender, brightness) {
		// Brightness control via webOS display service
		this.log("Brightness: " + brightness);
	},

	saveFontSetting: function(key, value) {
		try {
			var settings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			settings[key] = value;
			localStorage.setItem("ereader_settings", JSON.stringify(settings));
		} catch (e) {}
	},

	saveReadingPosition: function() {
		if (this.bookData && this.currentLocStart !== undefined) {
			this.bookData.locationsCompleted = this.currentLocStart;
			// Save to library
			try {
				var libraryJson = localStorage.getItem("ereader_library");
				var library = libraryJson ? JSON.parse(libraryJson) : [];
				for (var i = 0; i < library.length; i++) {
					if (library[i].asin === this.bookData.asin) {
						library[i].locationsCompleted = this.currentLocStart;
						library[i].lastAccessed = Date.now();
						break;
					}
				}
				localStorage.setItem("ereader_library", JSON.stringify(library));
			} catch (e) {}
		}
	},

	handleMouseDown: function(inSender, inEvent) {
		// Handle touch/click for page turning
		// Tap zones: left 30% = prev, right 30% = next, center 40% = overlays
		var x = inEvent.pageX || inEvent.clientX;
		var y = inEvent.pageY || inEvent.clientY;
		var width = window.innerWidth;

		console.log("BookReader.handleMouseDown: x=" + x + ", y=" + y + ", width=" + width + ", overlaysShowing=" + this.overlaysShowing + ", pluginReady=" + this.pluginReady);

		if (x < width * 0.30) {
			// Left 30% - previous page
			if (!this.overlaysShowing) {
				console.log("BookReader: Triggering PREVIOUS page");
				this.$.body.previousPage();
			} else {
				console.log("BookReader: Hiding overlays (left tap while overlays showing)");
				this.hideOverlays();
			}
		} else if (x > width * 0.70) {
			// Right 30% - next page
			if (!this.overlaysShowing) {
				console.log("BookReader: Triggering NEXT page");
				this.$.body.nextPage();
			} else {
				console.log("BookReader: Hiding overlays (right tap while overlays showing)");
				this.hideOverlays();
			}
		} else {
			// Center 40% - toggle overlays
			console.log("BookReader: Center tap - toggling overlays");
			this.showOverlays();
		}
	},

	handleNoteShowingChanged: function(inSender, showing) {
		// Notes visibility changed
	},

	handleEndOfBook: function(inSender, firstPage) {
		// Reached end or beginning of book
		this.log("End of book, firstPage: " + firstPage);
	},

	enableHistoryBack: function() {
		this.$.bottom_row.enableHistoryBack();
	},

	disableHistoryBack: function() {
		this.$.bottom_row.disableHistoryBack();
	},

	setAnimationConfig: function(val) {
		this.$.body.setAnimationConfig(val);
	},

	selectInitialFontType: function(fontType) {
		this.$.body.selectInitialFontType(fontType);
		this.$.top_row.setFontType(fontType);
	},

	selectInitialFontSize: function(fontSize) {
		this.$.body.selectInitialFontSize(fontSize);
		this.$.top_row.setFontSize(fontSize);
	},

	selectInitialTheme: function(theme) {
		this.$.body.selectInitialTheme(theme);
		this.$.top_row.setTheme(theme);
		this.updateThemeClass(theme);
	},

	handleWindowRotated: function() {
		if (this.pluginReady) {
			this.$.body.handleWindowRotated();
		}
	},

	goToLocation: function(location) {
		this.$.body.goToLocation(location);
	},

	goToPosition: function(position) {
		this.$.body.goToPosition(position);
	},

	getCurrentPosition: function() {
		return this.currentLocStart;
	}
});
