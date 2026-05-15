/**
 * ereader.LibraryNavigator - Library sidebar navigation
 *
 * Simplified version that uses localStorage instead of MojoDB.
 */
enyo.kind({
	name: "ereader.LibraryNavigator",
	kind: enyo.VFlexBox,
	events: {
		onCategorySelected: "",
		onLibrarySelected: "",
		onPanelBtnClicked: "",
		onImportBook: ""
	},
	className: "library-navigator",
	components: [
		{kind: "HFlexBox", name: "libraryHeader", className: "library-header", components: [
			{kind: "Button", name: "libraryBtn", className: "library-button", onclick: "doPanelBtnClicked", components: [
				{content: $L("Library"), name: "libraryTitle", className: "panel-header library-navigator-title"}
			]},
			{kind: "Button", name: "addCategoryBtn", className: "add-cat-button", onclick: "showAddCategory", label: " ", components: [
				{kind: "Image", src: "images/nav-icon-plus.png", className: "add-cat-button-icon"}
			]}
		]},
		{name: "booksBtn", content: $L("All Books"), onclick: "handleBooksClicked", className: "all-books-collection"},
		{flex: 1, kind: "Scroller", name: "listScroller", className: "library-menu", autoVertical: true, horizontal: false, components: [
			{kind: "VFlexBox", name: "categoriesList"}
		]},
		{kind: "HFlexBox", className: "import-button-container", components: [
			{kind: "Button", name: "importBtn", content: $L("Import ePub"), onclick: "handleImportClick", className: "enyo-button-light import-button", flex: 1}
		]},
		{kind: "Popup", name: "addCategoryBar", scrim: true, lazy: false, components: [
			{content: $L("Add new collection:")},
			{kind: "Input", name: "newCategoryNameBox", style: "margin: 10px 0;", onkeydown: "testEnter"},
			{kind: "HFlexBox", align: "center", components: [
				{kind: "Button", name: "newCategorySaveBtn", onclick: "saveNewCategory", className: "enyo-button-light button-label add-category-button", content: $L("Save")},
				{kind: "Button", name: "newCategoryCancelBtn", onclick: "hideAddCategory", className: "enyo-button-light button-label add-category-button", content: $L("Cancel")}
			]}
		]},
		{kind: "Popup", className: "pop-balloon collection-menu-popup", scrim: true, name: "categoryMenu", components: [
			{name: "collectionTitle", className: "collection-menu-header"},
			{kind: "VFlexBox", name: "itemMenuOptions", components: [
				{kind: "Button", content: $L("Open Collection"), onclick: "handleItemMenuCategorySelected"},
				{kind: "Button", content: $L("Rename Collection"), onclick: "handleCategoryRenamed"},
				{kind: "Button", content: $L("Delete Collection"), onclick: "handleCategoryDeleted"}
			]}
		]},
		{kind: "Popup", scrim: true, name: "confirmPopup", components: [
			{content: $L("Are you sure you want to delete this Collection?"), style: "width: 300px; margin: 10px; word-wrap:break-word;", name: "deleteColTitle"},
			{kind: "HFlexBox", flex: 1, components: [
				{kind: "Button", flex: 1, name: "okBtn", onclick: "deleteHeldCategory", className: "enyo-button-light", content: $L("OK")},
				{kind: "Button", flex: 1, name: "cancel", onclick: "dismissConfirmPopup", className: "enyo-button-light", content: $L("Cancel")}
			]}
		]}
	],

	categories: [],
	selectedCategory: "ereader-books-main",

	create: function() {
		this.inherited(arguments);
		this.isMinimized = false;
		this.$.categoryMenu.removeClass("enyo-popup");
		this.$.libraryBtn.removeClass("enyo-button");
		if (!window.PalmSystem) {
			// Shift icon + title right to clear the floating menu button
			this.$.libraryBtn.applyStyle("margin-left", "52px");
		}
		this.loadCategories();
	},

	loadCategories: function() {
		try {
			var saved = localStorage.getItem("ereader_categories");
			this.categories = saved ? JSON.parse(saved) : [];
		} catch (e) {
			this.categories = [];
		}
		this.rebuildCategoryList();
	},

	rebuildCategoryList: function() {
		this.$.categoriesList.destroyControls();
		for (var i = 0; i < this.categories.length; i++) {
			var category = this.categories[i];
			this.$.categoriesList.createComponent({
				kind: "Item",
				className: "category-item" + (category.id === this.selectedCategory ? " selected" : ""),
				onclick: "handleCategoryClick",
				onmousehold: "handleCategoryHold",
				owner: this,
				categoryId: category.id,
				components: [
					{content: category.name, className: "category-name"}
				]
			});
		}
		this.$.categoriesList.render();
	},

	saveCategories: function() {
		try {
			localStorage.setItem("ereader_categories", JSON.stringify(this.categories));
		} catch (e) {
			this.log("Failed to save categories: " + e);
		}
	},

	handleBooksClicked: function() {
		this.selectedCategory = "ereader-books-main";
		this.doCategorySelected("ereader-books-main");
		this.rebuildCategoryList();
	},

	handleCategoryClick: function(inSender) {
		this.selectedCategory = inSender.categoryId;
		this.doCategorySelected(inSender.categoryId);
		this.rebuildCategoryList();
	},

	handleCategoryHold: function(inSender) {
		this.heldCategory = inSender.categoryId;
		var category = null;
		for (var i = 0; i < this.categories.length; i++) {
			if (this.categories[i].id === inSender.categoryId) {
				category = this.categories[i];
				break;
			}
		}
		if (category) {
			this.$.collectionTitle.setContent(category.name);
			this.$.categoryMenu.openAtCenter();
		}
	},

	handleImportClick: function() {
		this.doImportBook();
	},

	showAddCategory: function(book) {
		this.bookToAddToCategory = book;
		this.$.newCategoryNameBox.setValue("");
		this.$.addCategoryBar.openAtCenter();
		this.$.newCategoryNameBox.forceFocus();
	},

	hideAddCategory: function() {
		this.$.addCategoryBar.close();
		this.bookToAddToCategory = null;
	},

	testEnter: function(inSender, inEvent) {
		if (inEvent.keyCode === 13) {
			this.saveNewCategory();
		}
	},

	saveNewCategory: function() {
		var name = this.$.newCategoryNameBox.getValue().trim();
		if (name.length > 0) {
			var newCategory = {
				id: "category_" + Date.now(),
				name: name,
				sortKey: this.categories.length
			};
			this.categories.push(newCategory);
			this.saveCategories();
			this.rebuildCategoryList();

			if (this.bookToAddToCategory) {
				this.bookToAddToCategory.categories = this.bookToAddToCategory.categories || [];
				this.bookToAddToCategory.categories.push(newCategory.id);
			}
		}
		this.hideAddCategory();
	},

	handleItemMenuCategorySelected: function() {
		this.$.categoryMenu.close();
		this.selectedCategory = this.heldCategory;
		this.doCategorySelected(this.heldCategory);
		this.rebuildCategoryList();
	},

	handleCategoryRenamed: function() {
		this.$.categoryMenu.close();
		var category = null;
		for (var i = 0; i < this.categories.length; i++) {
			if (this.categories[i].id === this.heldCategory) {
				category = this.categories[i];
				break;
			}
		}
		if (category) {
			this.$.newCategoryNameBox.setValue(category.name);
			this.renamingCategory = this.heldCategory;
			this.$.addCategoryBar.openAtCenter();
		}
	},

	handleCategoryDeleted: function() {
		this.$.categoryMenu.close();
		this.$.confirmPopup.openAtCenter();
	},

	deleteHeldCategory: function() {
		this.$.confirmPopup.close();
		var newCategories = [];
		for (var i = 0; i < this.categories.length; i++) {
			if (this.categories[i].id !== this.heldCategory) {
				newCategories.push(this.categories[i]);
			}
		}
		this.categories = newCategories;
		this.saveCategories();
		this.rebuildCategoryList();

		if (this.selectedCategory === this.heldCategory) {
			this.handleBooksClicked();
		}
	},

	dismissConfirmPopup: function() {
		this.$.confirmPopup.close();
	},

	selectCategory: function(categoryId) {
		this.selectedCategory = categoryId;
		this.rebuildCategoryList();
	},

	minimize: function() {
		this.isMinimized = true;
		this.$.libraryTitle.setContent("");
		this.$.addCategoryBtn.hide();
		this.$.importBtn.hide();
	},

	restore: function() {
		this.isMinimized = false;
		this.$.libraryTitle.setContent($L("Library"));
		this.$.addCategoryBtn.show();
		this.$.importBtn.show();
	}
});
