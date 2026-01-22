/**
 * ereader.ContentNavigator - Content grid/list view
 *
 * Simplified version that uses localStorage instead of MojoDB.
 */
enyo.kind({
	name: "ereader.ContentNavigator",
	kind: enyo.VFlexBox,
	className: "content-navigator",
	events: {
		onSearchQueried: "",
		onBookSelected: "",
		onCategorySelected: "",
		onAddCategorySelected: ""
	},
	components: [
		{kind: "HFlexBox", name: "viewBar", className: "content-header", align: "center", components: [
			{kind: "HFlexBox", components: [
				{name: "categoryTitle", className: "panel-header content-navigator-title truncate", content: $L("All Books")}
			]},
			{kind: "Spacer"},
			{kind: "HFlexBox", name: "headerControls", components: [
				{kind: "Button", className: "enyo-button-light sort-list-selector", components: [
					{kind: "ListSelector", className: "header-category-selector", onChange: "handleSortChange", name: "sortSelector", items: [
						{caption: $L("Title"), value: "title"},
						{caption: $L("Author"), value: "author"},
						{caption: $L("Most Recent"), value: "lastAccessed"}
					]}
				]},
				{kind: "RadioGroup", name: "viewControl", className: "radio-grid-list", onclick: "layoutClick", value: "ereader.contentContainer.GridViewItem", components: [
					{kind: "RadioButton", icon: "images/menu-icon-grid.png", value: "ereader.contentContainer.GridViewItem"},
					{kind: "RadioButton", icon: "images/menu-icon-list.png", value: "ereader.contentContainer.ListViewItem"}
				]}
			]},
			{kind: "ereader.ExpandingSearchBox", name: "searchBox", onSearchChanged: "handleSearchQueried", onBoxExpanded: "searchExpanded", onBoxCollapsed: "searchCollapsed", style: "margin-left: 10px;"}
		]},
		{name: "contentView", flex: 1, kind: "ereader.contentContainer.ViewBase", onBookSelected: "doBookSelected", onItemPressAndHold: "handleItemPressAndHold"},
		{kind: "ereader.contentContainer.ItemMenuPopup", name: "itemMenu", onBookSelected: "doBookSelected", onBookDeleted: "handleBookDeleted", onAddCategorySelected: "doAddCategorySelected"}
	],

	categoryId: "ereader-books-main",
	sortField: "lastAccessed",
	searchText: "",

	create: function() {
		this.inherited(arguments);
		this.$.contentView.setItemType("ereader.contentContainer.GridViewItem");
	},

	ready: function() {
		this.rebuildView();
	},

	layoutClick: function(inSender) {
		var value = inSender.getValue();
		this.log(value);
		this.$.contentView.setItemType(value, true);
		this.updateContentView(value);
	},

	setContentView: function(value) {
		this.log(value);
		this.$.viewControl.setValue(value);
		this.$.contentView.setItemType(value);
	},

	updateContentView: function(view) {
		try {
			var settings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			settings.currentContentView = view;
			localStorage.setItem("ereader_settings", JSON.stringify(settings));
		} catch (e) {}
	},

	setContentSort: function(sort) {
		this.sortField = sort;
		this.$.sortSelector.setValue(sort);
		this.rebuildView();
	},

	handleSortChange: function(inSender) {
		this.sortField = inSender.getValue();
		this.rebuildView();
		this.updateContentSort(this.sortField);
	},

	updateContentSort: function(sort) {
		try {
			var settings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			settings.currentContentSort = sort;
			localStorage.setItem("ereader_settings", JSON.stringify(settings));
		} catch (e) {}
	},

	setCategory: function(categoryId) {
		this.categoryId = categoryId;
		if (categoryId === "ereader-books-main") {
			this.$.categoryTitle.setContent($L("All Books"));
		} else {
			// Find category name
			try {
				var categories = JSON.parse(localStorage.getItem("ereader_categories") || "[]");
				var cat = categories.find(function(c) { return c.id === categoryId; });
				if (cat) {
					this.$.categoryTitle.setContent(cat.name);
				}
			} catch (e) {}
		}
		this.rebuildView();
	},

	handleSearchQueried: function(inSender, searchText) {
		this.searchText = searchText || "";
		this.rebuildView();
		this.doSearchQueried(searchText);
	},

	searchExpanded: function() {
		this.$.headerControls.hide();
	},

	searchCollapsed: function() {
		this.$.headerControls.show();
	},

	rebuildView: function() {
		var books = this.loadBooks();
		books = this.filterBooks(books);
		books = this.sortBooks(books);
		this.$.contentView.setBooks(books);
	},

	refreshView: function() {
		this.rebuildView();
	},

	resizeView: function() {
		this.$.contentView.resize();
	},

	loadBooks: function() {
		try {
			var libraryJson = localStorage.getItem("ereader_library");
			var library = libraryJson ? JSON.parse(libraryJson) : [];
			return library.map(function(bookJson) {
				return new BookData(bookJson);
			});
		} catch (e) {
			return [];
		}
	},

	filterBooks: function(books) {
		var self = this;

		// Filter by category
		if (this.categoryId !== "ereader-books-main") {
			books = books.filter(function(book) {
				return book.categories && book.categories.indexOf(self.categoryId) !== -1;
			});
		}

		// Filter by search text
		if (this.searchText && this.searchText.length > 0) {
			var searchLower = this.searchText.toLowerCase();
			books = books.filter(function(book) {
				return (book.title && book.title.toLowerCase().indexOf(searchLower) !== -1) ||
					   (book.author && book.author.toLowerCase().indexOf(searchLower) !== -1);
			});
		}

		return books;
	},

	sortBooks: function(books) {
		var sortField = this.sortField;

		books.sort(function(a, b) {
			var aVal, bVal;

			switch (sortField) {
				case "title":
					aVal = (a.titleIndex || a.title || "").toLowerCase();
					bVal = (b.titleIndex || b.title || "").toLowerCase();
					break;
				case "author":
					aVal = (a.authorIndex || a.author || "").toLowerCase();
					bVal = (b.authorIndex || b.author || "").toLowerCase();
					break;
				case "lastAccessed":
				default:
					aVal = b.lastAccessed || 0;  // Reverse for most recent first
					bVal = a.lastAccessed || 0;
					break;
			}

			if (aVal < bVal) return -1;
			if (aVal > bVal) return 1;
			return 0;
		});

		return books;
	},

	handleItemPressAndHold: function(inSender, book) {
		this.$.itemMenu.setBook(book);
		this.$.itemMenu.openAtCenter();
	},

	handleBookDeleted: function(inSender, book) {
		// Delete book from localStorage
		try {
			var libraryJson = localStorage.getItem("ereader_library");
			var library = libraryJson ? JSON.parse(libraryJson) : [];
			library = library.filter(function(b) { return b.asin !== book.asin; });
			localStorage.setItem("ereader_library", JSON.stringify(library));
		} catch (e) {}

		this.rebuildView();
	}
});
