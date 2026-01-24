/**
 * EpubRenderer - JavaScript replacement for the KRF native plugin
 *
 * This component wraps Preader's ePub rendering engine (EpubReader, HTMLBook, PageFitter)
 * to provide a compatible interface with the original Kindle KRF plugin.
 *
 * The KRF plugin used "locations" (Amazon's word-position format).
 * We use byte positions internally but expose a percentage-based location system
 * that maps 0-100% of the book to locations 0-10000.
 */
enyo.kind({
	name: "EpubRenderer",
	kind: "Control",

	// Published properties
	published: {
		fontSize: 20,
		fontType: 0,      // 0=Georgia, 1=Verdana
		themeColor: 0     // 0=white, 1=sepia, 2=black
	},

	// Events that match KRF callbacks
	events: {
		onInitializeBookCompleted: "",
		onDoRefreshPage: "",
		onShowOverlays: "",
		onHideOverlays: "",
		onShowNoteHighlight: "",
		onHideNoteHighlight: "",
		onHideDeleteHighlightButton: "",
		onKrfPluginError: "",
		onEnableBackButton: "",
		onShowNotes: "",
		onHideNotes: "",
		onEndOfBook: ""
	},

	// Internal state
	epubReader: null,
	htmlBook: null,
	pageFitter: null,
	currentStart: 0,
	currentEnd: 0,
	totalLength: 0,
	bookPath: null,
	bookReady: false,
	tocAvailable: false,
	navigationHistory: [],
	isAnimating: false,
	animationDirection: "next",

	// Components
	components: [
		{name: "pageContainer", kind: "Control", className: "epub-page-container"},
		{name: "offscreen", kind: "Control", className: "epub-offscreen"}
	],

	/**
	 * Create - set up initial state
	 */
	create: function() {
		this.inherited(arguments);
		this.navigationHistory = [];
		this.applyTheme();
	},

	/**
	 * Rendered - get actual dimensions
	 */
	rendered: function() {
		this.inherited(arguments);
	},

	// ========================================
	// KRF-COMPATIBLE PUBLIC METHODS
	// ========================================

	/**
	 * Initialize and load a book
	 * @param {String} bookPath - Path to the ePub file
	 * @param {Number} location - Starting location (0-10000 scale, representing 0-100%)
	 * @param {String} highlightsJSON - JSON string of highlights (not implemented yet)
	 * @param {Number} animation - Animation state (ignored)
	 * @param {Number} fontSize - Font size (12-32)
	 * @param {Number} fontType - Font type (0=Georgia, 1=Verdana)
	 * @param {Number} theme - Theme color (0=white, 1=sepia, 2=black)
	 * @param {String} bookDbName - Database name for pre-imported book (optional)
	 */
	initializeBook: function(bookPath, location, highlightsJSON, animation, fontSize, fontType, theme, bookDbName) {
		this.log("Initializing book: " + bookPath + " at location " + location);

		this.bookPath = bookPath;
		this.initialLocation = location || 0;
		this.fontSize = fontSize || 20;
		this.fontType = fontType || 0;
		this.themeColor = theme || 0;
		this.bookReady = false;

		this.applyTheme();
		this.applyFont();

		// If we have a database name, load from the existing HTMLBook
		if (bookDbName) {
			this.log("Loading from existing database: " + bookDbName);
			this.loadFromDatabase(bookDbName);
		} else {
			// Fall back to loading from file
			this.log("No database name, loading from file");
			this.loadEpub(bookPath);
		}
	},

	/**
	 * Load book content from existing HTMLBook database
	 */
	loadFromDatabase: function(dbName) {
		var self = this;

		this.log("Creating HTMLBook from database: " + dbName);

		// Create HTMLBook with null reader - it will load from existing database
		this.htmlBook = new HTMLBook(null, false, dbName, function(book) {
			if (!book || !book.isReady) {
				self.log("Database load failed, book not ready");
				self.doKrfPluginError("Failed to load book from database");
				return;
			}

			self.totalLength = book.getLength();
			self.log("Book loaded from database. Total length: " + self.totalLength);
			self.tocAvailable = true;

			// Create the PageFitter for pagination
			var offscreenNode = self.$.offscreen.hasNode();
			if (!offscreenNode) {
				self.log("Warning: offscreen node not available yet");
				offscreenNode = document.createElement("div");
				offscreenNode.style.position = "absolute";
				offscreenNode.style.visibility = "hidden";
				offscreenNode.style.width = "100%";
				document.body.appendChild(offscreenNode);
			}

			self.pageFitter = new PageFitter(book, offscreenNode, 2);  // 2 = UTF-8 encoding

			// Signal that the book is ready
			self.bookReady = true;
			self.doInitializeBookCompleted();

			// Go to the initial location
			if (self.initialLocation > 0) {
				self.gotoLocation(self.initialLocation);
			} else {
				self.refreshPage();
			}
		});
	},

	/**
	 * Load an ePub file (fallback for non-imported books)
	 */
	loadEpub: function(path) {
		var self = this;

		// Convert path to file:// URL if needed
		var fileUrl = path;
		if (fileUrl.indexOf("file://") !== 0 && fileUrl.indexOf("http") !== 0) {
			fileUrl = "file://" + path;
		}

		this.log("Loading ePub from file: " + fileUrl);

		// Create a File object to load the ePub
		var file = new File(fileUrl, function(loadedFile, caller) {
			if (loadedFile.failure || !loadedFile.ready) {
				self.doKrfPluginError("Failed to load ePub file: " + path);
				return;
			}

			self.log("File loaded, creating ZipFile...");

			// Create a ZipFile from the File (which is a ByteReader)
			var zipFile;
			try {
				zipFile = new ZipFile(loadedFile);
				if (zipFile.error !== 0) {
					self.doKrfPluginError("Failed to parse ZIP archive");
					return;
				}
			} catch (e) {
				self.doKrfPluginError("Failed to open ePub archive: " + e);
				return;
			}

			self.log("ZipFile created, parsing ePub...");

			// Create the EpubReader
			new EpubReader(zipFile, function(zip, reader) {
				if (reader == null) {
					self.doKrfPluginError("Failed to parse ePub file - may be corrupted or DRM protected");
					return;
				}

				self.epubReader = reader;
				self.tocAvailable = true;

				// Create the HTMLBook for chunked storage
				var dbName = "ereader_" + File.extractBasename(path).replace(/\.epub$/i, "");
				self.log("Creating HTMLBook with dbName: " + dbName);

				self.htmlBook = new HTMLBook(reader, false, dbName, function(book) {
					if (!book || !book.isReady) {
						self.doKrfPluginError("Failed to process ePub content");
						return;
					}

					self.totalLength = book.getLength();
					self.log("Book loaded. Total length: " + self.totalLength);

					// Create the PageFitter
					self.pageFitter = new PageFitter(book, self.$.offscreen.hasNode(), 2);  // 2 = UTF-8 encoding

					// Signal that the book is ready
					self.bookReady = true;
					self.doInitializeBookCompleted();

					// Go to the initial location
					if (self.initialLocation > 0) {
						self.gotoLocation(self.initialLocation);
					} else {
						self.refreshPage();
					}
				});
			}, null);
		}, self);
	},

	/**
	 * Go to a specific location (0-10000 scale)
	 */
	gotoLocation: function(location) {
		if (!this.bookReady) return;

		// Save current position to history
		if (this.currentStart > 0) {
			this.navigationHistory.push(this.currentStart);
		}

		// Convert location (0-10000) to byte position
		var bytePos = Math.floor((location / 10000) * this.totalLength);
		bytePos = Math.max(0, Math.min(bytePos, this.totalLength - 1));

		this.log("gotoLocation: " + location + " -> bytePos: " + bytePos);

		this.pageFitter.gotoPage(bytePos, true);
		this.refreshPage();
	},

	/**
	 * Go to a specific byte position
	 */
	gotoPosition: function(position) {
		if (!this.bookReady) return;

		// Save current position to history
		if (this.currentStart > 0) {
			this.navigationHistory.push(this.currentStart);
		}

		position = Math.max(0, Math.min(parseInt(position), this.totalLength - 1));
		this.pageFitter.gotoPage(position, true);
		this.refreshPage();
	},

	/**
	 * Go to the beginning of the book
	 */
	gotoBeginning: function() {
		if (!this.bookReady) return;

		this.navigationHistory.push(this.currentStart);
		this.pageFitter.gotoPage(0, false);
		this.refreshPage();
	},

	/**
	 * Go to Table of Contents (beginning for now)
	 */
	gotoTableOfContents: function() {
		this.gotoBeginning();
	},

	/**
	 * Go to location from search result
	 */
	gotoLocationSearchResult: function(location) {
		this.gotoLocation(location);
	},

	/**
	 * Navigate back in history
	 */
	historyBack: function() {
		if (this.navigationHistory.length > 0) {
			var pos = this.navigationHistory.pop();
			this.pageFitter.gotoPage(pos, false);
			this.refreshPage();
		}
	},

	/**
	 * Check if history exists
	 */
	isHistoryBackExist: function() {
		return this.navigationHistory.length > 0 ? "true" : "false";
	},

	/**
	 * Navigate to next page
	 */
	nextPage: function() {
		console.log("EpubRenderer.nextPage: bookReady=" + this.bookReady + ", pageFitter=" + (this.pageFitter ? "yes" : "no"));
		if (!this.bookReady || this.isAnimating) {
			console.log("EpubRenderer.nextPage: ABORTED - book not ready or animating");
			return;
		}

		var screenHeight = this.getScreenHeight();
		console.log("EpubRenderer.nextPage: screenHeight=" + screenHeight + ", calling pageFitter.getNextPage");
		var self = this;

		// Start slide animation
		this.startSlideAnimation("next");

		this.pageFitter.getNextPage(screenHeight, function(html) {
			console.log("EpubRenderer.nextPage callback: html=" + (html === null ? "null" : "length " + html.length));
			if (html === null) {
				// End of book - reset animation
				self.resetAnimation();
				console.log("EpubRenderer.nextPage: END OF BOOK reached");
				self.doEndOfBook("false");
				return;
			}
			self.displayPageWithAnimation(html);
		});
	},

	/**
	 * Navigate to previous page
	 */
	previousPage: function() {
		console.log("EpubRenderer.previousPage: bookReady=" + this.bookReady + ", pageFitter=" + (this.pageFitter ? "yes" : "no"));
		if (!this.bookReady || this.isAnimating) {
			console.log("EpubRenderer.previousPage: ABORTED - book not ready or animating");
			return;
		}

		var screenHeight = this.getScreenHeight();
		console.log("EpubRenderer.previousPage: screenHeight=" + screenHeight + ", calling pageFitter.getPrevPage");
		var self = this;

		// Start slide animation
		this.startSlideAnimation("prev");

		this.pageFitter.getPrevPage(screenHeight, function(html) {
			console.log("EpubRenderer.previousPage callback: html=" + (html === null ? "null" : "length " + html.length));
			if (html === null) {
				// Beginning of book - reset animation
				self.resetAnimation();
				console.log("EpubRenderer.previousPage: BEGINNING OF BOOK reached");
				self.doEndOfBook("true");
				return;
			}
			self.displayPageWithAnimation(html);
		});
	},

	/**
	 * Refresh/redraw the current page
	 */
	refreshPage: function() {
		console.log("EpubRenderer.refreshPage: bookReady=" + this.bookReady);
		if (!this.bookReady) {
			console.log("EpubRenderer.refreshPage: ABORTED - book not ready");
			return;
		}

		var screenHeight = this.getScreenHeight();
		console.log("EpubRenderer.refreshPage: screenHeight=" + screenHeight);
		var self = this;

		this.pageFitter.getCurrPage(screenHeight, function(html) {
			console.log("EpubRenderer.refreshPage callback: html=" + (html === null ? "null" : "length " + html.length));
			if (html === null) {
				console.log("EpubRenderer.refreshPage: FAILED to render page");
				self.doKrfPluginError("Failed to render page");
				return;
			}
			self.displayPage(html);
		});
	},

	/**
	 * Set font size (12-32)
	 */
	setFontSize: function(size) {
		this.fontSize = size;
		this.applyFont();
		if (this.bookReady) {
			this.refreshPage();
		}
	},

	/**
	 * Set font type (0=Georgia, 1=Verdana)
	 */
	setTypeFace: function(type) {
		this.fontType = type;
		this.applyFont();
		if (this.bookReady) {
			this.refreshPage();
		}
	},

	/**
	 * Set theme color (0=white, 1=sepia, 2=black)
	 */
	setNightModeColor: function(color) {
		this.themeColor = color;
		this.applyTheme();
		if (this.bookReady) {
			this.refreshPage();
		}
	},

	/**
	 * Check if font can be changed (always true for ePub)
	 */
	canChangeFont: function() {
		return "true";
	},

	/**
	 * Refresh highlights (not implemented yet)
	 */
	refreshHighlights: function(highlightsJSON) {
		// TODO: Implement highlight rendering
		this.log("refreshHighlights called (not implemented)");
	},

	/**
	 * Overlay state change handler
	 */
	overlayStateChange: function(state) {
		// Used by Kindle to show/hide toolbars
		this.log("overlayStateChange: " + state);
	},

	/**
	 * Get info for storing a bookmark
	 */
	getInfoForStoringBookmark: function() {
		var location = this.positionToLocation(this.currentStart);
		return JSON.stringify({
			"objects": [{
				"annotationType": "Bookmark",
				"start": this.currentStart.toString(),
				"end": this.currentEnd.toString(),
				"pagePosition": this.currentStart.toString(),
				"sentenceText": location + "#Page " + Math.floor(location / 100) + " of 100"
			}]
		});
	},

	/**
	 * Get info for storing a note
	 */
	getInfoForStoringNote: function() {
		var location = this.positionToLocation(this.currentStart);
		return JSON.stringify({
			"objects": [{
				"annotationType": "Note",
				"start": this.currentStart.toString(),
				"end": this.currentEnd.toString(),
				"pagePosition": this.currentStart.toString(),
				"sentenceText": location + "#"
			}]
		});
	},

	/**
	 * Get current POSIX timestamp
	 */
	getCurrentPOSIXTimeStamp: function() {
		return Math.floor(Date.now() / 1000).toString();
	},

	/**
	 * Convert position to location
	 */
	convertPositionToLocation: function(position) {
		return this.positionToLocation(parseInt(position)).toString();
	},

	/**
	 * Highlight user selected area (not implemented)
	 */
	highlightUserSelectedArea: function() {
		this.log("highlightUserSelectedArea (not implemented)");
		return "";
	},

	/**
	 * Delete selected highlight (not implemented)
	 */
	deleteSelectedHighlight: function() {
		this.log("deleteSelectedHighlight (not implemented)");
	},

	/**
	 * Get covering rect for position IDs (not implemented - for note indicators)
	 */
	getCoveringRectJSONForPositionIDs: function(positionString) {
		// Return empty result - notes won't be positioned correctly but won't crash
		return JSON.stringify({"objects": []});
	},

	/**
	 * Highlight position (not implemented)
	 */
	highlightThisPositionID: function(positionId) {
		this.log("highlightThisPositionID: " + positionId + " (not implemented)");
	},

	/**
	 * Highlight multiple positions (not implemented)
	 */
	highlightMultiplePositionIDs: function(positionId, numWords) {
		this.log("highlightMultiplePositionIDs (not implemented)");
	},

	/**
	 * Reset search
	 */
	resetSearch: function() {
		this.searchResults = [];
		this.log("Search reset");
	},

	/**
	 * Search for text in the book content
	 * @param {String} searchText - Text to search for
	 * @param {Function} callback - Called with array of {text, location, position} results
	 */
	searchBook: function(searchText, callback) {
		if (!this.htmlBook || !searchText || searchText.length < 2) {
			callback([]);
			return;
		}

		var self = this;
		var results = [];
		var searchLower = searchText.toLowerCase();
		var maxResults = 50;
		var chunkSize = 4096;
		var totalLength = this.totalLength;
		var currentPos = 0;
		var contextChars = 40;  // Characters of context on each side

		// Search function that processes chunks
		var searchChunk = function() {
			if (currentPos >= totalLength || results.length >= maxResults) {
				// Done searching
				self.searchResults = results;
				callback(results);
				return;
			}

			// Read a chunk
			var readLength = Math.min(chunkSize, totalLength - currentPos);
			self.htmlBook.read(currentPos, readLength, function(byteBuf) {
				if (!byteBuf || byteBuf.length === 0) {
					// Move to next chunk
					currentPos += chunkSize - 100;  // Overlap to catch matches at boundaries
					setTimeout(searchChunk, 0);
					return;
				}

				// Convert bytes to text (stripping HTML tags)
				var text = self.bytesToText(byteBuf);
				var textLower = text.toLowerCase();

				// Search for matches
				var index = 0;
				while ((index = textLower.indexOf(searchLower, index)) !== -1) {
					if (results.length >= maxResults) break;

					// Get surrounding context
					var start = Math.max(0, index - contextChars);
					var end = Math.min(text.length, index + searchText.length + contextChars);
					var contextText = text.substring(start, end);

					// Add ellipsis if truncated
					if (start > 0) contextText = "..." + contextText;
					if (end < text.length) contextText = contextText + "...";

					// Highlight the match
					var highlightStart = (start > 0 ? 3 : 0) + (index - start);
					var beforeMatch = contextText.substring(0, highlightStart);
					var match = contextText.substring(highlightStart, highlightStart + searchText.length);
					var afterMatch = contextText.substring(highlightStart + searchText.length);
					contextText = beforeMatch + "<b>" + match + "</b>" + afterMatch;

					// Calculate position in book
					var matchPosition = currentPos + index;
					var matchLocation = self.positionToLocation(matchPosition);

					results.push({
						text: contextText,
						location: matchLocation,
						position: matchPosition
					});

					index += searchText.length;
				}

				// Move to next chunk (with overlap)
				currentPos += chunkSize - 100;
				setTimeout(searchChunk, 0);
			});
		};

		// Start searching
		searchChunk();
	},

	/**
	 * Convert byte buffer to plain text (strip HTML)
	 */
	bytesToText: function(byteBuf) {
		var text = "";
		for (var i = 0; i < byteBuf.length; i++) {
			var c = byteBuf[i];
			if (c >= 32 && c < 127) {
				text += String.fromCharCode(c);
			} else if (c === 10 || c === 13) {
				text += " ";
			}
		}
		// Strip HTML tags
		text = text.replace(/<[^>]*>/g, " ");
		// Normalize whitespace
		text = text.replace(/\s+/g, " ");
		return text;
	},

	/**
	 * Get Table of Contents from HTMLBook bookmarks
	 * Returns array of {title, location, position} objects
	 */
	getToc: function() {
		if (!this.htmlBook || !this.htmlBook.bookmarks) {
			return [];
		}

		var tocItems = [];
		var bookmarks = this.htmlBook.bookmarks;

		for (var i = 0; i < bookmarks.length; i++) {
			var bm = bookmarks[i];
			if (bm && bm.label && bm.position !== undefined) {
				// Convert byte position to location (0-10000)
				var location = this.positionToLocation(bm.position);

				// Create a display title from the label
				// Labels are typically anchor ids like "chapter1", "part2_section3", etc.
				var title = this.formatBookmarkLabel(bm.label);

				tocItems.push({
					title: title,
					label: bm.label,
					location: location,
					position: bm.position
				});
			}
		}

		// Sort by position
		tocItems.sort(function(a, b) {
			return a.position - b.position;
		});

		// Filter to only include likely chapter markers (skip small anchors)
		// This is a heuristic - we keep entries that are spaced reasonably apart
		var filteredToc = [];
		var lastPosition = -10000;
		var minSpacing = Math.floor(this.totalLength / 100); // At least 1% apart

		for (var i = 0; i < tocItems.length; i++) {
			var item = tocItems[i];
			// Include if it's at the beginning, or spaced far enough from the last
			if (item.position < 1000 || (item.position - lastPosition) > minSpacing) {
				// Only include items with reasonable-looking labels
				if (this.isLikelyChapterLabel(item.label)) {
					filteredToc.push(item);
					lastPosition = item.position;
				}
			}
		}

		this.tocAvailable = filteredToc.length > 0;
		return filteredToc;
	},

	/**
	 * Format a bookmark label into a readable title
	 */
	formatBookmarkLabel: function(label) {
		if (!label) return "Unknown";

		// Common patterns to clean up
		var title = label
			.replace(/[-_]/g, ' ')           // Replace dashes/underscores with spaces
			.replace(/([a-z])([A-Z])/g, '$1 $2')  // Add space before capitals
			.replace(/([0-9]+)/g, ' $1 ')    // Add space around numbers
			.replace(/\s+/g, ' ')            // Normalize spaces
			.trim();

		// Capitalize first letter of each word
		title = title.replace(/\b\w/g, function(c) { return c.toUpperCase(); });

		// If it's too short or just a number, make it more descriptive
		if (title.length < 3 || /^[0-9\s]+$/.test(title)) {
			title = "Section " + label;
		}

		return title;
	},

	/**
	 * Check if a label is likely a chapter/section marker
	 */
	isLikelyChapterLabel: function(label) {
		if (!label) return false;

		var lowerLabel = label.toLowerCase();

		// Positive indicators - looks like a chapter marker
		var chapterPatterns = [
			/^ch(apter)?/,    // chapter, ch1, etc.
			/^part/,          // part1, part_2, etc.
			/^section/,       // section
			/^book/,          // book1, etc.
			/^calibre/,       // calibre-generated IDs
			/^id[0-9]/,       // id1, id2, etc.
			/^toc/,           // toc references
			/^[a-z]+[0-9]+$/, // word followed by number
			/^[0-9]+$/        // just a number
		];

		for (var i = 0; i < chapterPatterns.length; i++) {
			if (chapterPatterns[i].test(lowerLabel)) {
				return true;
			}
		}

		// If it has more than 5 characters and starts with a letter, include it
		if (label.length > 5 && /^[a-zA-Z]/.test(label)) {
			return true;
		}

		return false;
	},

	// ========================================
	// INTERNAL METHODS
	// ========================================

	/**
	 * Start fade-out animation for page turn
	 */
	startSlideAnimation: function(direction) {
		this.isAnimating = true;
		var container = this.$.pageContainer.hasNode();
		if (container) {
			container.className = "epub-page-container page-turning";
		}
	},

	/**
	 * Reset animation state
	 */
	resetAnimation: function() {
		this.isAnimating = false;
		var container = this.$.pageContainer.hasNode();
		if (container) {
			container.className = "epub-page-container";
		}
	},

	/**
	 * Display page with fade animation
	 */
	displayPageWithAnimation: function(html) {
		var self = this;
		// Wait for fade-out (150ms), then update content and fade in
		setTimeout(function() {
			self.displayPage(html);
			var container = self.$.pageContainer.hasNode();
			if (container) {
				container.className = "epub-page-container";
			}
			// Clear animation flag after fade-in
			setTimeout(function() {
				self.isAnimating = false;
			}, 160);
		}, 160);
	},

	/**
	 * Display rendered HTML content
	 */
	displayPage: function(html) {
		// Update current position from pageFitter
		this.currentStart = this.pageFitter.currStart;
		this.currentEnd = this.pageFitter.currEnd;

		// Debug: log what we're rendering
		var htmlLen = html ? html.length : 0;
		var preview = html ? html.substring(0, 500).replace(/\s+/g, ' ') : "(null)";
		this.log("displayPage: pos=" + this.currentStart + "-" + this.currentEnd + ", htmlLen=" + htmlLen);
		this.log("displayPage CONTENT: " + preview);

		// Render the HTML content
		var container = this.$.pageContainer.hasNode();
		if (container) {
			container.innerHTML = html;
		}

		// Calculate location info in KRF format: "StartLoc-EndLoc#Percent%#StartPos-EndPos"
		var startLoc = this.positionToLocation(this.currentStart);
		var endLoc = this.positionToLocation(this.currentEnd);
		var percent = Math.floor((this.currentStart / this.totalLength) * 100);

		var locationInfo = startLoc + "-" + endLoc + "#" + percent + "%#" + this.currentStart + "-" + this.currentEnd;

		// Fire the refresh page event
		this.doDoRefreshPage(locationInfo, this.tocAvailable ? "true" : "false");

		// Update history back button state
		this.doEnableBackButton(this.navigationHistory.length > 0 ? "true" : "false");
	},

	/**
	 * Convert byte position to location (0-10000 scale)
	 */
	positionToLocation: function(position) {
		if (this.totalLength <= 0) return 0;
		return Math.floor((position / this.totalLength) * 10000);
	},

	/**
	 * Convert location (0-10000) to byte position
	 */
	locationToPosition: function(location) {
		return Math.floor((location / 10000) * this.totalLength);
	},

	/**
	 * Get available screen height for content
	 * Use the actual pageContainer height for accurate page calculation
	 */
	getScreenHeight: function() {
		var container = this.$.pageContainer.hasNode();
		if (container && container.offsetHeight > 0) {
			// Use actual container height
			this.log("getScreenHeight: using container.offsetHeight = " + container.offsetHeight);
			return container.offsetHeight;
		}
		// Fallback: calculate from window height minus padding and toolbar space
		var fallback = window.innerHeight - 160;
		this.log("getScreenHeight: fallback = " + fallback);
		return fallback;
	},

	/**
	 * Apply current theme colors
	 */
	applyTheme: function() {
		var container = this.$.pageContainer.hasNode();
		var offscreen = this.$.offscreen.hasNode();

		var bgColor, textColor;
		switch (this.themeColor) {
			case 0: // White
				bgColor = "#FFFFFF";
				textColor = "#000000";
				break;
			case 1: // Sepia
				bgColor = "#E5DBC6";
				textColor = "#5B4636";
				break;
			case 2: // Black (night mode)
				bgColor = "#353535";
				textColor = "#CCCCCC";
				break;
			default:
				bgColor = "#FFFFFF";
				textColor = "#000000";
		}

		if (container) {
			container.style.backgroundColor = bgColor;
			container.style.color = textColor;
		}
		if (offscreen) {
			offscreen.style.backgroundColor = bgColor;
			offscreen.style.color = textColor;
		}
	},

	/**
	 * Apply current font settings
	 */
	applyFont: function() {
		var container = this.$.pageContainer.hasNode();
		var offscreen = this.$.offscreen.hasNode();

		var fontFamily = this.fontType === 0 ? "Georgia, serif" : "Verdana, sans-serif";
		var fontSize = this.fontSize + "px";
		var lineHeight = (this.fontSize * 1.5) + "px";

		var applyStyles = function(el) {
			if (el) {
				el.style.fontFamily = fontFamily;
				el.style.fontSize = fontSize;
				el.style.lineHeight = lineHeight;
			}
		};

		applyStyles(container);
		applyStyles(offscreen);
	},

	/**
	 * Get book metadata
	 */
	getMetadata: function() {
		if (this.epubReader) {
			return this.epubReader.getMetadata();
		}
		return null;
	},

	/**
	 * Get current reading position as percentage (0-100)
	 */
	getReadingProgress: function() {
		if (this.totalLength <= 0) return 0;
		return Math.floor((this.currentStart / this.totalLength) * 100);
	},

	/**
	 * Clean up resources
	 */
	destroy: function() {
		this.epubReader = null;
		this.htmlBook = null;
		this.pageFitter = null;
		this.inherited(arguments);
	}
});
