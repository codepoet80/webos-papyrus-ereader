/**
 * ereader.panels.MainPanels - Main navigation panels
 *
 * Sliding pane that contains the library navigator and content view.
 */
enyo.kind({
	name: "ereader.panels.MainPanels",
	kind: enyo.SlidingPane,
	className: "kindle-panel",
	events: {
		onBookSelected: "",
		onSearchQueried: "",
		onMarkupSelected: "",
		onSlideoutPanelBtnClicked: "",
		onImportBook: ""
	},
	components: [
		{name: "libraryPanel", width: "320px", className: "library-panel", kind: "SlidingView", components: [
			{kind: "ereader.LibraryNavigator", name: "libraryView", flex: 1, onCategorySelected: "handleLibraryViewCatChange", onPanelBtnClicked: "slideBtnClicked", onImportBook: "doImportBook"}
		]},
		{name: "contentPanel", peekWidth: 64, width: "704px", fixedWidth: true, dragAnywhere: false, className: "content-panel", kind: "SlidingView", components: [
			{kind: "ereader.ContentNavigator", flex: 1, name: "itemView", onBookSelected: "doBookSelected", onSearchQueried: "onSearchQueried", onMarkupSelected: "onMarkupSelected", onCategorySelected: "handleContentViewCatChange", onAddCategorySelected: "handleAddCategorySelected"},
			{className: "drag-handle", onclick: "slideBtnClicked", name: "slideBtn"}
		]}
	],
	categoryId: "ereader-books-main",

	create: function() {
		this.inherited(arguments);
		if (window.innerWidth > window.innerHeight) {
			this.showLandscapeView(true);
		}
		else {
			this.showPortraitView(true);
		}
	},

	handleLibraryViewCatChange: function(o, categoryId) {
		this.log();
		this.$.itemView.setCategory(categoryId);
		this.categoryId = categoryId;
	},

	handleContentViewCatChange: function(o, categoryId) {
		this.log();
		this.$.libraryView.selectCategory(categoryId);
		this.categoryId = categoryId;
	},

	handleAddCategorySelected: function(o, book) {
		this.log();
		this.$.libraryView.showAddCategory(book);
	},

	getCurrentCategoryId: function() {
		return this.categoryId;
	},

	selectCategory: function(category) {
		this.log();
		this.handleLibraryViewCatChange(null, category);
	},

	selectContentViewType: function(type) {
		this.$.itemView.setContentView(type);
	},

	selectContentSort: function(sort) {
		this.$.itemView.setContentSort(sort);
	},

	slideBtnClicked: function(inSender) {
		enyo.asyncMethod(this, function() {
			if (this.view.name == this.$.libraryPanel.name) {
				this.selectContentView();
			}
			else {
				this.selectLibraryView();
			}
		});
	},

	rebuildView: function() {
		this.$.itemView.rebuildView();
	},

	refreshView: function() {
		this.$.itemView.refreshView();
	},

	resizeView: function() {
		this.$.itemView.resizeView();
	},

	showLandscapeView: function(async) {
		this.selectLibraryView(async);
		this.$.slideBtn.hide();
		this.resizeView();
	},

	showPortraitView: function(async) {
		this.$.slideBtn.show();
		this.selectContentView(async);
		this.resizeView();
	},

	handleWindowRotated: function(orientation) {
		if (orientation == "up" || orientation == "down") {
			this.showLandscapeView(true);
		}
		else {
			this.showPortraitView(true);
		}
	},

	selectLibraryView: function(async) {
		if (async === true) {
			this.canAnimate = false;
		}
		this.selectView(this.$.libraryPanel, async);
		if (async === true) {
			this.canAnimate = true;
		}
		this.$.libraryView.restore();
	},

	selectContentView: function(async) {
		if (window.innerWidth < window.innerHeight) {
			if (async === true) {
				this.canAnimate = false;
			}
			this.selectView(this.$.contentPanel, async);
			if (async === true) {
				this.canAnimate = true;
			}
			this.$.libraryView.minimize();
		}
	},

	handleResize: function(inSender) {
		if (this.$.libraryPanel.slideState == "selected") {
			this.$.libraryView.restore();
		}
		else {
			this.$.libraryView.minimize();
		}
	}
});
