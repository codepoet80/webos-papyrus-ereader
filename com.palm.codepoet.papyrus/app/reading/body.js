/**
 * ereader.body - Book content display component
 *
 * This component manages the book rendering area and user interactions.
 * Originally used the native KRF plugin, now uses the JavaScript EpubRenderer.
 */
enyo.kind({
	name: "ereader.body",
	kind: "VFlexBox",
	events: {
		onTocAvailableChanged: "",
		onPluginReady: "",
		onBookmarkUpdated: "",
		onLocationChanged: "",
		onShowOverlays: "",
		onPluginDisconnected: "",
		onPluginStarted: "",
		onKRFError: "",
		onNotesShowingChanged: "",
		onEndOfBook: ""
	},
	published: {},
	alreadyHid: false,
	components: [
		{kind: "Popup", name: "markupBox", preventContentOverflow: false, lazy: false, style: "position:absolute;", pack: "center", align: "center", dismissWithClick: false, scrim: false, className: "", onOpen: "onMarkupBoxClosed", components: [
			{kind: "VFlexBox", flex: 1, className: "pop-balloon white", name: "markupBoxContainer", components: [
				{kind: "RadioGroup", name: "markupSelector", pack: "center", align: "center", className: "radio-group-markup-selector", value: -1, components: [
					{name: "noteBtn", label: $L("Note"), flex: 0, onclick: "onNote", value: 0},
					{name: "hBtn", label: $L("Highlight"), flex: 0, onclick: "onHighlight", value: 1},
					{name: "deleteHiglightBtn", label: $L("Delete Highlight"), flex: 0, className: 'enyo-last', onclick: "onDeleteHighlight", value: 2}
				]},
				{name: "balloonBottom", className: "balloon-bottom"},
			]},
		]},

		{kind: "Popup", name: "noteBox", scrim: true, lazy: false, onClose: "onNoteBoxClosed", components: [
			{kind: "VFlexBox", className: "note white", name: "noteBoxContainer", components: [
				{kind: "BasicScroller", flex: 1, className: "note-textarea", name: "noteInputScroller", components: [
					{kind: "RichText", name: "noteTxt", className: "", changeOnKeypress: true, richContent: false},
				]},
				{kind: "HFlexBox", components: [
					{kind: "Button", flex: 1, name: "saveNote", className: "button-label", content: $L("Save"), onclick: "saveNote"},
					{kind: "Button", flex: 1, name: "delNote", className: "enyo-button-negative button-label", content: $L("Delete"), onclick: "delNote", showing: false}
				]}
			]}
		]},
		{kind: "VFlexBox", name: "noteIndicatorBox", style: "z-index: 105;position:absolute;"},

		// EpubRenderer replaces the KRF native plugin
		{kind: "EpubRenderer", name: "epubRenderer", flex: 1, className: "epub-renderer",
			onInitializeBookCompleted: "initializeBookCompleted",
			onDoRefreshPage: "doRefreshPage",
			onShowOverlays: "showOverlays",
			onShowNoteHighlight: "showNoteHighlight",
			onHideNoteHighlight: "hideNoteHighlight",
			onHideDeleteHighlightButton: "hideDeleteHighlightButton",
			onKrfPluginError: "krfPluginError",
			onEnableBackButton: "enableBackButton",
			onShowNotes: "showNotes",
			onHideNotes: "hideNotes",
			onEndOfBook: "endofBook"
		},

		{kind: "Image", name: "testImg", style: "top: 0px;left:0px;z-index: 0;position:absolute;", onclick: "tstThing", showing: false},

		{kind: "Popup", name: "noteContentBox", style: "position:absolute;width:300px;", dismissWithClick: true, pack: "center", align: "center", lazy: false, scrim: false, modal: true, className: "", onClose: "onNoteContentBoxClosed", components: [
			{kind: "HFlexBox", components: [
				{kind: "Spacer"},
				{kind: "VFlexBox", className: "pop-balloon white", style: "position:relative;", name: "noteContentBoxContainer", components: [
					{name: "noteBalloonTop", className: "note-balloon-top balloon-top"},
					{kind: "Button", pack: "center", pack: "center", className: "note-content-box", onclick: "handleEditNote", name: "noteContentBtn", components: [
						{kind: "BasicScroller", name: "noteContentScroller", components: [
							{name: "noteContentTxt", className: "note-content", content: $L("This is a test note.")},
						]},
					]},
					{name: "noteBalloonBottom", className: "balloon-bottom"},
				]},
				{kind: "Spacer"},
			]},
		]},

		{kind: "Popup", name: "deleteNoteConfirmPopup", scrim: true, components: [
			{content: $L("Delete note?"), className: "delete-note-title"},
			{content: $L("This note will be deleted."), className: "delete-note-text"},
			{kind: "HFlexBox", flex: 1, components: [
				{kind: "Button", flex: 1, name: "deleteNoteCancelBtn", onclick: "cancelledDelNote", className: "enyo-button-light button-label add-category-button", content: $L("Cancel")},
				{kind: "Button", flex: 1, name: "deleteNoteConfirmBtn", onclick: "confirmedDelNote", className: "enyo-button-light button-label add-category-button", content: $L("Delete")}
			]}
		]},

		// Local database services for annotations (using WebSQL instead of MojoDB)
		{name: "annotationDB", kind: "Control"}
	],

	pluginReady: false,
	animationState: 0,
	initialFontType: 0,
	initialFontSize: 20,
	initialTheme: 0,

	// Annotation storage (persisted to localStorage)
	annotations: [],
	bookmark: null,

	create: function() {
		this.inherited(arguments);
		this.annotations = [];
		this.loadAnnotationsFromStorage();
	},

	/**
	 * Load all annotations from localStorage
	 */
	loadAnnotationsFromStorage: function() {
		try {
			var stored = localStorage.getItem("ereader_annotations");
			this.annotations = stored ? JSON.parse(stored) : [];
			console.log("body: Loaded " + this.annotations.length + " annotations from storage");
		} catch (e) {
			console.log("body: Error loading annotations: " + e);
			this.annotations = [];
		}
	},

	/**
	 * Save all annotations to localStorage
	 */
	saveAnnotationsToStorage: function() {
		try {
			localStorage.setItem("ereader_annotations", JSON.stringify(this.annotations));
			console.log("body: Saved " + this.annotations.length + " annotations to storage");
		} catch (e) {
			console.log("body: Error saving annotations: " + e);
		}
	},

	rendered: function() {
		this.inherited(arguments);
		// No need to set plugin dimensions - EpubRenderer handles its own sizing
	},

	tstThing: function(o, xy) {
		this.notePoint = {"x": xy.offsetX, "y": xy.offsetY};
		if (this.$.markupBox.showing) {
			this.hideNoteHighlight();
		} else {
			this.showNoteHighlight(xy.offsetX + ":" + xy.offsetY + ":" + xy.offsetX + ":" + xy.offsetY + ":5:5");
		}
		this.doShowOverlays();
	},

	handlePluginReady: function() {
		this.log("EpubRenderer ready for initialization");
		this.pluginReady = true;
		this.bookInitialized = false;
		this.doPluginStarted();
	},

	handlePluginDisconnected: function() {
		this.doPluginDisconnected();
		this.pluginReady = false;
		this.bookInitialized = false;
	},

	/**
	 * Initialize a book with the EpubRenderer
	 */
	initializeWithBook: function(book) {
		this.currentBook = book;
		this.pluginReady = true;
		this.bookInitialized = false;

		// Get saved settings
		var fontSize = this.initialFontSize || 20;
		var fontType = this.initialFontType || 0;
		var theme = this.initialTheme || 0;

		// Load highlights for this book (from local storage)
		var highlights = this.getHighlightsForBook(book);
		var highlightsJSON = highlights.length > 0 ? JSON.stringify({objects: highlights}) : "NONE";

		// Initialize the EpubRenderer
		// Pass bookDbName to load from pre-imported database
		this.$.epubRenderer.initializeBook(
			book.bookFilePath,
			book.locationsCompleted || 0,
			highlightsJSON,
			this.animationState,
			fontSize,
			fontType,
			theme,
			book.bookDbName
		);
	},

	/**
	 * Get highlights for a book from local storage
	 */
	getHighlightsForBook: function(book) {
		// Filter annotations for this book
		return this.annotations.filter(function(a) {
			return a.contentIdentifier === book.asin &&
				   a.annotationType === "Highlight" &&
				   a.isDeleted !== "1";
		});
	},

	/**
	 * Find highlights to update the renderer
	 */
	findHighlightsToUpdateKrf: function() {
		if (this.pluginReady && this.currentBook) {
			var highlights = this.getHighlightsForBook(this.currentBook);
			if (highlights.length < 1) {
				this.$.epubRenderer.refreshHighlights("NONE");
			} else {
				var resultString = JSON.stringify({objects: highlights});
				this.$.epubRenderer.refreshHighlights(resultString);
			}
		}
	},

	blank: function() {},

	initializeBookCompleted: function() {
		this.log("Book initialization completed");
		if (!this.bookInitialized && this.pluginReady) {
			this.bookInitialized = true;
			// Don't fire doPluginReady yet.  The page is blank until PageFitter
			// finishes its binary search (dozens of WebSQL + image reads on a
			// heavy book).  We set waitingForFirstPage so doRefreshPage fires
			// doPluginReady once actual HTML is in the container.
			this.waitingForFirstPage = true;
			// Signal that the book data is loaded and rendering has started,
			// so BookReader can update the loading spinner message.
			this.doPluginStarted();
		}
	},

	krfPluginError: function(inSender, errorMessage) {
		console.error("EpubRenderer error: " + errorMessage);
		this.pluginReady = false;
		this.bookInitialized = false;
		this.doKRFError(errorMessage);
	},

	enableBackButton: function(inSender, action) {
		if (action === "true") {
			this.owner.enableHistoryBack();
		} else {
			this.owner.disableHistoryBack();
		}
	},

	setAnimationConfig: function(val) {
		this.animationState = (val) ? 0 : 1;
	},

	/**
	 * Show annotations on the current page
	 */
	showPageAnnotations: function(annotations) {
		this.doBookmarkUpdated(false);
		this.$.noteIndicatorBox.destroyControls();

		if (annotations && annotations.length > 0) {
			for (var i = 0; i < annotations.length; i++) {
				var annotation = annotations[i];
				if (annotation.annotationType === "Note") {
					// Position notes at a default location since we don't have exact coordinates
					this.createNoteButton(annotation, 50, (i + 1) * 50);
				} else if (annotation.annotationType === "Bookmark") {
					this.doBookmarkUpdated(true);
					this.bookmark = annotation;
				}
			}
			this.$.noteIndicatorBox.render();
			this.doNotesShowingChanged(true);
		}
	},

	updateAnnotations: function() {
		this.findHighlightsToUpdateKrf();
		this.findPageAnnotations();
	},

	findPageAnnotations: function() {
		this.$.noteIndicatorBox.show();
		// Filter annotations for current page position
		var pageAnnotations = this.annotations.filter(enyo.bind(this, function(a) {
			return a.contentIdentifier === this.currentBook.asin &&
				   a.isDeleted !== "1" &&
				   a.start >= this.currentPosStart &&
				   a.start <= this.currentPosEnd;
		}));
		this.showPageAnnotations(pageAnnotations);
	},

	toggleBookmark: function(toggleState) {
		toggleState = (toggleState == null) ? (this.bookmark == null) : toggleState;
		if (toggleState === (this.bookmark != null)) {
			return;
		}
		if (toggleState) {
			var bookmarkJsonString = this.$.epubRenderer.getInfoForStoringBookmark();
			var bookmarkJson = JSON.parse(bookmarkJsonString)["objects"][0];
			bookmarkJson["start"] = parseInt(bookmarkJson["start"]);
			bookmarkJson["end"] = parseInt(bookmarkJson["start"]);
			bookmarkJson["pagePosition"] = parseInt(bookmarkJson["pagePosition"]);
			bookmarkJson["isDeleted"] = "0";
			bookmarkJson["annotationId"] = Math.uuid();
			bookmarkJson["contentIdentifier"] = this.currentBook.asin;
			bookmarkJson["nearestLocation"] = parseInt(bookmarkJson["sentenceText"].split("#")[0]);
			bookmarkJson["sentenceText"] = bookmarkJson["sentenceText"].split("#")[1];
			this.addAnnotationToDB(bookmarkJson);
		} else {
			this.deleteAnnotationFromDB(this.bookmark);
		}
	},

	createNoteButton: function(noteEntry, x, y) {
		this.$.noteIndicatorBox.createComponent({
			kind: "IconButton",
			style: "position:absolute;left:" + (x - 7) + "px;top:" + (y - 10) + "px;width: 32px;height: 32px;",
			icon: "images/reader-icon-note-indicator.png",
			className: "",
			onclick: "showNoteContent",
			locX: x,
			locY: y,
			noteEntry: noteEntry,
			owner: this,
		});
	},

	delNote: function(inSender) {
		this.$.deleteNoteConfirmPopup.openAtCenter();
	},

	confirmedDelNote: function(inSender) {
		this.$.deleteNoteConfirmPopup.close();
		this.deleteAnnotationFromDB(this.$.noteBox.noteEntry);
		this.$.noteBox.close();
	},

	cancelledDelNote: function(inSender) {
		this.$.deleteNoteConfirmPopup.close();
	},

	saveNote: function(inSender) {
		var noteText = this.$.noteTxt.getValue();
		noteText = noteText.replace(/&nbsp;/g, " ");
		noteText = noteText.replace("<br>", " ");
		noteText = noteText.replace(/<\/?[a-z][a-z0-9]*[^<>]*>/ig, "");
		noteText = enyo.string.removeHtml(noteText);
		noteText = enyo.string.trim(noteText);

		if (this.$.noteBox.noteEntry != null && this.$.noteBox.noteEntry != "") {
			if (noteText.length > 0) {
				this.deleteAnnotationFromDB(this.$.noteBox.noteEntry);
				this.$.noteBox.noteEntry["userText"] = noteText;
				this.$.noteBox.noteEntry["annotationId"] = Math.uuid();

				delete this.$.noteBox.noteEntry["_id"];

				this.addAnnotationToDB(this.$.noteBox.noteEntry);
				this.$.noteBox.close();
			} else {
				this.delNote();
			}
		} else if (noteText.length > 0) {
			var noteJsonString = this.$.epubRenderer.getInfoForStoringNote();
			var noteJson = JSON.parse(noteJsonString)["objects"][0];
			noteJson["start"] = parseInt(noteJson["start"]);
			noteJson["end"] = parseInt(noteJson["end"]);
			noteJson["pagePosition"] = parseInt(noteJson["pagePosition"]);
			noteJson["userText"] = noteText;
			noteJson["isDeleted"] = "0";
			noteJson["annotationId"] = Math.uuid();
			noteJson["contentIdentifier"] = this.currentBook.asin;
			noteJson["nearestLocation"] = parseInt(noteJson["sentenceText"].split("#")[0]);
			noteJson["sentenceText"] = noteJson["sentenceText"].split("#")[1];
			this.addAnnotationToDB(noteJson);
			this.$.noteBox.close();
		}
	},

	deleteAnnotationFromDB: function(annotationEntry) {
		// Mark as deleted in local array
		for (var i = 0; i < this.annotations.length; i++) {
			if (this.annotations[i].annotationId === annotationEntry.annotationId) {
				this.annotations[i].isDeleted = "1";
				break;
			}
		}
		this.saveAnnotationsToStorage();
		this.findPageAnnotations();
	},

	addAnnotationToDB: function(annotationEntry) {
		this.annotations.push(annotationEntry);
		this.saveAnnotationsToStorage();
		this.findPageAnnotations();
	},

	handleEditNote: function(inSender) {
		var noteEntry = this.$.noteContentBox.noteEntry;
		this.$.noteContentBox.close();
		this.onNote(noteEntry);
	},

	showNoteContent: function(inSender) {
		var leftVal = inSender.locX - 148;
		var topVal = inSender.locY + 20;

		// Position the note content box
		if (window.outerWidth - leftVal < 310) {
			this.$.noteContentBoxContainer.removeClass("note-container-farleft");
			this.$.noteContentBoxContainer.addClass("note-container-farright");
		} else if (leftVal < 10) {
			this.$.noteContentBoxContainer.removeClass("note-container-farright");
			this.$.noteContentBoxContainer.addClass("note-container-farleft");
		} else {
			this.$.noteContentBoxContainer.removeClass("note-container-farright");
			this.$.noteContentBoxContainer.removeClass("note-container-farleft");
		}

		this.$.noteContentTxt.setContent(inSender.noteEntry["userText"]);
		this.$.noteContentBox.locX = inSender.locX;
		this.$.noteContentBox.locY = inSender.locY;
		this.$.noteContentBox.noteEntry = inSender.noteEntry;
		this.$.noteContentBox.openAt({left: leftVal, top: topVal});
	},

	dbFailure: function(inSender, inError, inRequest) {
		this.log(enyo.json.to(inError));
	},

	onNote: function(noteEntry) {
		this.$.markupBox.close();

		if (noteEntry && noteEntry.userText != null) {
			this.$.noteTxt.setValue(noteEntry.userText);
			this.$.noteBox.noteEntry = noteEntry;
			this.$.delNote.show();
			this.$.noteBox.openAtCenter();
		} else {
			this.$.noteBox.noteEntry = null;
			this.$.noteBox.openAtCenter();
			this.$.noteTxt.forceFocus();
		}
		this.notePoint = null;
	},

	onHighlight: function() {
		this.$.markupBox.close();
		this.$.epubRenderer.highlightUserSelectedArea();
	},

	onDeleteHighlight: function() {
		this.$.markupBox.close();
		this.hideDeleteHighlightButton();
		this.$.epubRenderer.deleteSelectedHighlight();
	},

	/**
	 * Handle page refresh callback from EpubRenderer
	 * locationInfo format: "StartLoc-EndLoc#Percent%#StartPos-EndPos"
	 */
	doRefreshPage: function(inSender, locationInfo, isTOCAvailable) {
		// First page is now in the DOM — tell BookReader to close the spinner
		// and show the toolbars.  On slow books this can be many seconds after
		// initializeBookCompleted, so we deliberately delay until here.
		if (this.waitingForFirstPage) {
			this.waitingForFirstPage = false;
			this.doPluginReady();
		}

		this.log("Page refreshed: " + locationInfo);
		var locationText = locationInfo.split("#");
		var percent = (locationText[1].split("%"))[0];
		var locSplit = locationText[0].split("-");

		if (this.currentLocStart != parseInt(locSplit[0])) {
			this.$.noteIndicatorBox.destroyControls();
			this.doNotesShowingChanged(false);
			this.doBookmarkUpdated(false);
		}

		if (isTOCAvailable === "true") {
			this.setTocAvailable(true);
		} else {
			this.setTocAvailable(false);
		}

		this.currentLocStart = parseInt(locSplit[0]);
		this.currentLocEnd = parseInt(locSplit[1]);
		locSplit = locationText[2].split("-");

		// Note: Removed doShowOverlays call here - it was causing overlays to appear after every page turn

		this.currentPosStart = parseInt(locSplit[0]);
		this.currentPosEnd = parseInt(locSplit[1]);
		this.doLocationChanged(this.currentLocStart, this.currentLocEnd, this.totalLocations, this.currentPosStart, this.currentPosEnd);
		this.bookmark = null;
		this.findPageAnnotations();
	},

	showNoteHighlight: function(inSender, noteData) {
		var mousePositionText = noteData.split(":");
		this.notePoint = {
			"x": parseInt(mousePositionText[2]) + parseInt(mousePositionText[4]),
			"y": parseInt(mousePositionText[3]),
			"startPosition": parseInt(mousePositionText[7]),
			"endPosition": parseInt(mousePositionText[8])
		};
		this.mousePoint = {"x": parseInt(mousePositionText[0]), "y": parseInt(mousePositionText[1])};

		if (parseInt(mousePositionText[6]) === 1) {
			this.$.deleteHiglightBtn.show();
			var openRect = {
				"top": this.notePoint.y - 60,
				"left": (this.notePoint.x + parseInt(mousePositionText[2])) / 2 - 165
			};
			if (openRect.left <= 0) {
				openRect.left = 5;
			} else if (openRect.left > (window.innerWidth - 275)) {
				openRect.left = window.innerWidth - 275;
			}
			this.$.markupBox.openAt(openRect);
		} else {
			this.hideDeleteHighlightButton();
			this.$.markupBox.openAt({
				"top": this.notePoint.y - 60,
				"left": (this.notePoint.x + parseInt(mousePositionText[2])) / 2 - 85
			});
		}
	},

	showNotes: function() {
		this.findPageAnnotations();
		this.doNotesShowingChanged(true);
	},

	hideNotes: function() {
		this.$.noteIndicatorBox.hide();
		this.$.noteContentBox.close();
		this.doNotesShowingChanged(false);
	},

	hideNoteHighlight: function() {
		this.$.markupBox.close();
		this.$.noteBox.close();
	},

	showOverlays: function() {
		this.$.markupBox.close();
		this.$.noteBox.close();
		this.doShowOverlays();
	},

	hideDeleteHighlightButton: function() {
		this.$.deleteHiglightBtn.hide();
	},

	onMarkupBoxClosed: function() {
		this.$.markupSelector.setValue(-1);
	},

	onNoteBoxClosed: function() {
		this.$.noteTxt.setValue("");
		this.$.noteBox.noteEntry = null;
		this.$.noteInputScroller.setScrollTop(0);
		this.$.delNote.hide();
		this.$.epubRenderer.refreshPage();
	},

	onNoteContentBoxClosed: function() {
		this.$.noteContentBox.noteEntry = null;
		this.$.noteContentScroller.setScrollTop(0);
	},

	setTocAvailable: function(available) {
		this.doTocAvailableChanged(available);
	},

	handleWindowRotated: function(orientation) {
		if (this.pluginReady) {
			this.clearNotes();
			this.$.epubRenderer.refreshPage();
		}
	},

	endofBook: function(inSender, firstpage) {
		this.doEndOfBook(firstpage);
	},

	// Navigation methods - delegate to EpubRenderer
	goToLocation: function(location) {
		this.$.epubRenderer.gotoLocation(parseInt(location));
	},

	goToPosition: function(position) {
		this.$.epubRenderer.gotoPosition(position);
	},

	goToLocationSearchResult: function(location) {
		this.$.epubRenderer.gotoLocationSearchResult(parseInt(location));
	},

	goToBeginning: function() {
		this.$.epubRenderer.gotoBeginning();
	},

	historyBack: function() {
		this.$.epubRenderer.historyBack();
	},

	goToTableOfContents: function() {
		this.$.epubRenderer.gotoTableOfContents();
	},

	highlightPosition: function(positionId) {
		this.$.epubRenderer.highlightThisPositionID(positionId);
	},

	highlightMultiplePositions: function(positionId, numberOfWords) {
		this.$.epubRenderer.highlightMultiplePositionIDs(positionId, parseInt(numberOfWords));
	},

	checkFontChange: function() {
		var canChange = this.$.epubRenderer.canChangeFont();
		return canChange === "true";
	},

	setFontSize: function(size) {
		this.clearNotes();
		this.$.epubRenderer.setFontSize(size);
		this.initialFontSize = size;
	},

	setFontType: function(type) {
		this.clearNotes();
		this.$.epubRenderer.setTypeFace(type);
		this.initialFontType = type;
	},

	setThemeColor: function(color) {
		this.$.epubRenderer.setNightModeColor(color);
		this.initialTheme = color;
	},

	getSnapshotBuffer: function() {
		var bookmarkJsonString = this.$.epubRenderer.getInfoForStoringBookmark();
		var bookmarkJson = JSON.parse(bookmarkJsonString)["objects"][0];
		return bookmarkJson["pageSnapshotBuffer"] || "";
	},

	getPosixTimestamp: function() {
		return this.$.epubRenderer.getCurrentPOSIXTimeStamp();
	},

	changeCSSClassesTo: function(theclass) {
		this.$.markupBoxContainer.removeClass("sepia");
		this.$.markupBoxContainer.removeClass("white");
		this.$.markupBoxContainer.removeClass("black");
		this.$.markupBoxContainer.addClass(theclass);
		this.$.epubRenderer.removeClass("sepia");
		this.$.epubRenderer.removeClass("white");
		this.$.epubRenderer.removeClass("black");
		this.$.epubRenderer.addClass(theclass);
		this.$.noteBoxContainer.removeClass("sepia");
		this.$.noteBoxContainer.removeClass("white");
		this.$.noteBoxContainer.removeClass("black");
		this.$.noteBoxContainer.addClass(theclass);
		this.$.noteContentBoxContainer.removeClass("sepia");
		this.$.noteContentBoxContainer.removeClass("white");
		this.$.noteContentBoxContainer.removeClass("black");
		this.$.noteContentBoxContainer.addClass(theclass);
	},

	closePopups: function() {
		this.$.markupBox.close();
		this.$.noteBox.close();
	},

	clearNotes: function() {
		this.$.noteIndicatorBox.destroyControls();
		this.doNotesShowingChanged(false);
		this.$.noteContentBox.close();
	},

	doesHistoryExist: function() {
		var historyExists = this.$.epubRenderer.isHistoryBackExist();
		return historyExists === "true";
	},

	convertPositionToLocation: function(position) {
		var locationString = this.$.epubRenderer.convertPositionToLocation(position + "");
		return parseInt(locationString);
	},

	overlayStateChange: function(state) {
		this.$.epubRenderer.overlayStateChange(state);
	},

	selectInitialFontType: function(fontType) {
		this.initialFontType = fontType;
	},

	selectInitialFontSize: function(fontSize) {
		this.initialFontSize = fontSize;
	},

	selectInitialTheme: function(theme) {
		this.initialTheme = theme;
	},

	/**
	 * Navigate to next page (called from touch/swipe handlers)
	 */
	nextPage: function() {
		console.log("body.nextPage: delegating to epubRenderer");
		this.$.epubRenderer.nextPage();
	},

	/**
	 * Navigate to previous page (called from touch/swipe handlers)
	 */
	previousPage: function() {
		console.log("body.previousPage: delegating to epubRenderer");
		this.$.epubRenderer.previousPage();
	}
});
