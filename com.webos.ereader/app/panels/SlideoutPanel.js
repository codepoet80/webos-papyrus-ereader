/**
 * ereader.panels.SlideoutPanel - Slideout panel for TOC, Search, Markups
 *
 * Simplified version that removes MojoDB dependencies.
 */
enyo.kind({
	name: "ereader.panels.SlideoutPanel",
	kind: enyo.HFlexBox,
	events: {
		onSlidingDragBtnClicked: "",
		onSearchResultSelected: "",
		onMarkupsResultSelected: "",
		onSearchQueried: ""
	},
	className: "slideout-panel",
	published: {
		currentBook: null
	},
	components: [
		{kind: "Pane", name: "contentPane", width: 700, flex: 1, transitionKind: "enyo.transitions.Simple", components: [
			{name: "coverView", kind: "ereader.panels.CoverView", className: "enyo-bg"},
			{name: "tocView", kind: "ereader.panels.TocView", onTocItemSelected: "handleTocItemSelected", className: "enyo-bg"},
			{name: "markupsView", kind: "ereader.panels.MarkupsView", onMarkupsResultSelected: "doMarkupsResultSelected", className: "enyo-bg"},
			{name: "searchView", kind: "ereader.panels.SearchView", onSearchResultSelected: "doSearchResultSelected", onSearchQueried: "doSearchQueried", className: "enyo-bg"}
		]}
	],

	create: function() {
		this.inherited(arguments);
	},

	rendered: function() {
		this.inherited(arguments);
	},

	currentBookChanged: function() {
		// Update all views with the current book
		if (this.$.coverView && this.$.coverView.setBook) {
			this.$.coverView.setBook(this.currentBook);
		}
		if (this.$.tocView && this.$.tocView.setBook) {
			this.$.tocView.setBook(this.currentBook);
		}
		if (this.$.markupsView && this.$.markupsView.setBook) {
			this.$.markupsView.setBook(this.currentBook);
		}
		if (this.$.searchView && this.$.searchView.setBook) {
			this.$.searchView.setBook(this.currentBook);
		}
	},

	selectView: function(viewName) {
		switch (viewName) {
			case "cover":
				this.goToCoverView();
				break;
			case "toc":
				this.goToTocView();
				break;
			case "markups":
				this.goToMarkupsView();
				break;
			case "search":
				this.goToSearchView();
				break;
		}
	},

	goToSearchView: function() {
		this.$.contentPane.selectView(this.$.searchView, false);
	},

	goToCoverView: function() {
		this.$.contentPane.selectView(this.$.coverView, false);
	},

	goToTocView: function() {
		this.$.contentPane.selectView(this.$.tocView, false);
	},

	goToMarkupsView: function() {
		this.$.contentPane.selectView(this.$.markupsView, false);
	},

	handleTocItemSelected: function(inSender, tocItem) {
		// TOC item selected - navigate to that location
		this.doSearchResultSelected({location: tocItem.location});
	},

	slidingDragBtnClick: function(inSender) {
		this.doSlidingDragBtnClicked();
	}
});

/**
 * ereader.panels.CoverView - Book cover display
 */
enyo.kind({
	name: "ereader.panels.CoverView",
	kind: enyo.VFlexBox,
	className: "cover-view",
	published: {
		book: null
	},
	components: [
		{kind: "VFlexBox", flex: 1, align: "center", pack: "center", components: [
			{kind: "Image", name: "coverImage", className: "cover-image", style: "max-width: 300px; max-height: 400px;"},
			{name: "bookTitle", className: "cover-title", content: ""},
			{name: "bookAuthor", className: "cover-author", content: ""}
		]}
	],

	bookChanged: function() {
		if (this.book) {
			this.$.bookTitle.setContent(this.book.title || "");
			this.$.bookAuthor.setContent(this.book.author || "");
			if (this.book.coverImagePath) {
				this.$.coverImage.setSrc(this.book.coverImagePath);
				this.$.coverImage.show();
			} else {
				this.$.coverImage.hide();
			}
		}
	}
});

/**
 * ereader.panels.TocView - Table of Contents
 */
enyo.kind({
	name: "ereader.panels.TocView",
	kind: enyo.VFlexBox,
	className: "toc-view",
	events: {
		onTocItemSelected: ""
	},
	published: {
		book: null
	},
	components: [
		{kind: "Header", content: $L("Table of Contents")},
		{kind: "Scroller", flex: 1, components: [
			{kind: "VFlexBox", name: "tocList"}
		]},
		{name: "emptyMessage", content: $L("No table of contents available."), className: "empty-message", showing: false}
	],

	tocItems: [],

	bookChanged: function() {
		// Fetch TOC from EpubRenderer via the global app reference
		this.tocItems = [];

		try {
			var app = window.EReaderApp;
			if (app && app.$.reader && app.$.reader.$.body && app.$.reader.$.body.$.epubRenderer) {
				var renderer = app.$.reader.$.body.$.epubRenderer;
				if (renderer.getToc) {
					this.tocItems = renderer.getToc();
				}
			}
		} catch (e) {
			console.log("TocView: Error getting TOC: " + e);
		}

		this.rebuildTocList();
	},

	rebuildTocList: function() {
		this.$.tocList.destroyControls();
		for (var i = 0; i < this.tocItems.length; i++) {
			var item = this.tocItems[i];
			this.$.tocList.createComponent({
				kind: "Item",
				className: "toc-item",
				onclick: "handleTocClick",
				owner: this,
				tocItem: item,
				components: [
					{content: item.title, className: "toc-item-title"}
				]
			});
		}
		this.$.tocList.render();
		this.$.emptyMessage.setShowing(this.tocItems.length === 0);
	},

	handleTocClick: function(inSender) {
		this.doTocItemSelected(inSender.tocItem);
	}
});

/**
 * ereader.panels.MarkupsView - Bookmarks, Notes, Highlights
 */
enyo.kind({
	name: "ereader.panels.MarkupsView",
	kind: enyo.VFlexBox,
	className: "markups-view",
	events: {
		onMarkupsResultSelected: ""
	},
	published: {
		book: null
	},
	components: [
		{kind: "Header", content: $L("My Notes & Marks")},
		{kind: "Scroller", flex: 1, components: [
			{kind: "VFlexBox", name: "markupsList"}
		]},
		{name: "emptyMessage", content: $L("No notes or bookmarks yet."), className: "empty-message", showing: true}
	],

	markups: [],

	bookChanged: function() {
		this.loadMarkups();
	},

	loadMarkups: function() {
		// Load markups from localStorage
		if (!this.book) {
			this.markups = [];
		} else {
			try {
				var allMarkups = JSON.parse(localStorage.getItem("ereader_annotations") || "[]");
				this.markups = allMarkups.filter(function(m) {
					return m.contentIdentifier === this.book.asin && m.isDeleted !== "1";
				}.bind(this));
			} catch (e) {
				this.markups = [];
			}
		}
		this.rebuildMarkupsList();
	},

	rebuildMarkupsList: function() {
		this.$.markupsList.destroyControls();
		for (var i = 0; i < this.markups.length; i++) {
			var markup = this.markups[i];
			var icon = "images/reader-icon-bookmark.png";
			var text = markup.sentenceText || "";

			if (markup.annotationType === "Note") {
				icon = "images/reader-icon-note-indicator.png";
				text = markup.userText || "";
			} else if (markup.annotationType === "Highlight") {
				icon = "images/reader-icon-highlight.png";
			}

			this.$.markupsList.createComponent({
				kind: "Item",
				className: "markup-item",
				onclick: "handleMarkupClick",
				owner: this,
				markup: markup,
				components: [
					{kind: "HFlexBox", components: [
						{kind: "Image", src: icon, className: "markup-icon"},
						{kind: "VFlexBox", flex: 1, components: [
							{content: text, className: "markup-text"}
						]}
					]}
				]
			});
		}
		this.$.markupsList.render();
		this.$.emptyMessage.setShowing(this.markups.length === 0);
	},

	handleMarkupClick: function(inSender) {
		this.doMarkupsResultSelected({position: inSender.markup.start});
	}
});

/**
 * ereader.panels.SearchView - Search in book
 */
enyo.kind({
	name: "ereader.panels.SearchView",
	kind: enyo.VFlexBox,
	className: "search-view",
	events: {
		onSearchResultSelected: "",
		onSearchQueried: ""
	},
	published: {
		book: null
	},
	components: [
		{kind: "Header", content: $L("Search")},
		{kind: "HFlexBox", className: "search-bar", components: [
			{kind: "Input", name: "searchInput", flex: 1, hint: $L("Search in book..."), onkeydown: "handleKeyDown"},
			{kind: "Button", content: $L("Search"), onclick: "doSearch"}
		]},
		{kind: "Scroller", flex: 1, components: [
			{kind: "VFlexBox", name: "resultsList"}
		]},
		{name: "emptyMessage", content: $L("Enter a search term above."), className: "empty-message", showing: true},
		{name: "noResults", content: $L("No results found."), className: "empty-message", showing: false}
	],

	results: [],

	handleKeyDown: function(inSender, inEvent) {
		if (inEvent.keyCode === 13) {
			this.doSearch();
		}
	},

	doSearch: function() {
		var searchText = this.$.searchInput.getValue().trim();
		if (searchText.length < 2) {
			return;
		}

		this.doSearchQueried(searchText);

		// Show searching message
		this.$.emptyMessage.setContent($L("Searching..."));
		this.$.emptyMessage.show();
		this.$.noResults.hide();
		this.results = [];
		this.rebuildResultsList();

		// Get EpubRenderer and search
		var self = this;
		try {
			var app = window.EReaderApp;
			if (app && app.$.reader && app.$.reader.$.body && app.$.reader.$.body.$.epubRenderer) {
				var renderer = app.$.reader.$.body.$.epubRenderer;
				renderer.searchBook(searchText, function(results) {
					self.results = results;
					self.rebuildResultsList();
					self.$.emptyMessage.setContent($L("Enter a search term above."));
					self.$.emptyMessage.hide();
					self.$.noResults.setShowing(results.length === 0);
				});
			} else {
				// No renderer available
				this.$.emptyMessage.setContent($L("Open a book first to search."));
				this.$.emptyMessage.show();
			}
		} catch (e) {
			console.log("SearchView: Error searching: " + e);
			this.$.emptyMessage.setContent($L("Search error."));
			this.$.emptyMessage.show();
		}
	},

	rebuildResultsList: function() {
		this.$.resultsList.destroyControls();
		for (var i = 0; i < this.results.length; i++) {
			var result = this.results[i];
			this.$.resultsList.createComponent({
				kind: "Item",
				className: "search-result-item",
				onclick: "handleResultClick",
				owner: this,
				result: result,
				components: [
					{content: result.text, className: "search-result-text", allowHtml: true}
				]
			});
		}
		this.$.resultsList.render();
	},

	handleResultClick: function(inSender) {
		this.doSearchResultSelected({location: inSender.result.location});
	}
});
