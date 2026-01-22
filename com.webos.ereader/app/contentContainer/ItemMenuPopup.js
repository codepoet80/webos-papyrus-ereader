/**
 * ereader.contentContainer.ItemMenuPopup - Context menu for book items
 *
 * Simplified version without Amazon-specific features.
 */
enyo.kind({
	name: "ereader.contentContainer.ItemMenuPopup",
	kind: "ModalDialog",
	events: {
		onBookSelected: "",
		onBookDeleted: "",
		onBookCategoriesChanged: "",
		onAddCategorySelected: ""
	},
	scrim: true,
	dismissWithClick: true,
	lazy: false,
	published: {
		book: null
	},
	components: [
		{kind: "VFlexBox", name: "itemMenuOptions", components: [
			{kind: "HFlexBox", name: "bookHeader", pack: "center", align: "center", className: "item-menu-header", components: [
				{name: "itemHeaderImage", kind: "Image", className: "item-menu-img"},
				{name: "itemHeaderTitle", flex: 1, className: "item-menu-title"},
			]},
			{kind: "Group", name: "collectionGroup", className: "category-selector-group", components: [
				{kind: "Scroller", name: "scroller", className: "category-selector-scroller", autoVertical: true, horizontal: false, showing: true, components: [
					{kind: "VFlexBox", name: "itemMenuCategories", className: "category-selector-list", flex: 1}
				]},
			]},
			{kind: "Button", name: "openBtn", content: $L("Open Book"), onclick: "handleBookSelected"},
			{kind: "Button", name: "deleteBtn", content: $L("Delete Book"), onclick: "handleDeleteBook", className: "enyo-button-negative"},
		]},
	],

	create: function() {
		this.inherited(arguments);
		this.categories = [];
	},

	setBook: function(book) {
		this.book = book;
	},

	openAtCenter: function() {
		this.inherited(arguments);

		if (!this.book) return;

		// Set book header
		var coverPath = this.book.coverImagePath || "images/item-cover-default.png";
		coverPath = coverPath.replace(/.png$/i, "-small.png").replace(/.jpg$/i, "-small.jpg");
		this.$.itemHeaderImage.setSrc(coverPath);
		this.$.itemHeaderTitle.setContent(this.book.title || "");

		// Load categories
		this.loadCategories();

		this.$.scroller.setScrollTop(0);
	},

	loadCategories: function() {
		this.$.itemMenuCategories.destroyControls();

		try {
			this.categories = JSON.parse(localStorage.getItem("ereader_categories") || "[]");
		} catch (e) {
			this.categories = [];
		}

		for (var i = 0; i < this.categories.length; i++) {
			var cat = this.categories[i];
			var isSelected = this.book.categories && this.book.categories.indexOf(cat.id) !== -1;

			this.$.itemMenuCategories.createComponent({
				owner: this,
				name: "cat" + i,
				kind: "ereader.contentContainer.ItemMenuCategory",
				category: cat.name,
				categoryId: cat.id,
				selected: isSelected,
				onSelect: "handleCategorySelected"
			});
		}

		// Add "Create Collection" option
		this.$.itemMenuCategories.createComponent({
			owner: this,
			name: "catAdd",
			kind: "ereader.contentContainer.ItemMenuCategory",
			category: $L("Create a Collection"),
			categoryId: "_new_",
			selected: false,
			onSelect: "handleAddCategorySelected"
		});

		this.render();
	},

	handleBookSelected: function() {
		this.doBookSelected(this.book);
		this.close();
	},

	handleDeleteBook: function() {
		this.doBookDeleted(this.book);
		this.close();
	},

	handleAddCategorySelected: function() {
		this.close();
		this.doAddCategorySelected(this.book);
	},

	handleCategorySelected: function(inSender) {
		if (inSender.categoryId === "_new_") {
			this.handleAddCategorySelected();
			return;
		}

		if (!this.book.categories) {
			this.book.categories = [];
		}

		var catIndex = this.book.categories.indexOf(inSender.categoryId);
		if (inSender.selected) {
			// Deselect - remove from categories
			inSender.setSelected(false);
			if (catIndex !== -1) {
				this.book.categories.splice(catIndex, 1);
			}
		} else {
			// Select - add to categories
			inSender.setSelected(true);
			if (catIndex === -1) {
				this.book.categories.push(inSender.categoryId);
			}
		}

		// Save to library
		this.saveBookCategories();
		this.doBookCategoriesChanged(this.book, inSender.categoryId);
	},

	saveBookCategories: function() {
		try {
			var libraryJson = localStorage.getItem("ereader_library");
			var library = libraryJson ? JSON.parse(libraryJson) : [];
			for (var i = 0; i < library.length; i++) {
				if (library[i].asin === this.book.asin) {
					library[i].categories = this.book.categories;
					break;
				}
			}
			localStorage.setItem("ereader_library", JSON.stringify(library));
		} catch (e) {
			this.log("Error saving book categories: " + e);
		}
	}
});

/**
 * ereader.contentContainer.ItemMenuCategory - Category item in context menu
 */
enyo.kind({
	name: "ereader.contentContainer.ItemMenuCategory",
	kind: enyo.Item,
	tapHighlight: false,
	className: "list-view-item",
	events: {
		onSelect: ""
	},
	published: {
		category: "",
		categoryId: "",
		selected: false
	},
	components: [
		{kind: "HFlexBox", components: [
			{kind: "Control", name: "categoryName", content: "", flex: 1, onclick: "handleSelection"},
			{name: "selectImg", kind: "Image", src: "images/item-menu-checkmark.png", onclick: "handleSelection", showing: false}
		]}
	],

	create: function() {
		this.inherited(arguments);
		this.$.categoryName.setContent(this.category);
		if (this.selected) {
			this.$.selectImg.show();
		}
	},

	selectedChanged: function() {
		if (this.selected) {
			this.$.selectImg.show();
		} else {
			this.$.selectImg.hide();
		}
	},

	handleSelection: function() {
		this.doSelect();
	}
});
