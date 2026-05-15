/**
 * SlidingView subclass used only for the content panel.
 *
 * In single-view (phone), Enyo's applySingleViewLayout zeroes peekWidth on
 * every panel, so calcSlideAfter returns library.calcSlideMin()=0, placing the
 * content panel fully off-screen when the library is selected. There is no
 * standard peekWidth setting that produces an "after-panel peek" in single-view.
 *
 * Override: return -contentPeek so translateX(-contentPeek) pulls the panel's
 * left edge to (screenWidth - contentPeek), leaving contentPeek px visible on
 * the right edge — exactly where the drag handle sits.
 *
 * Multi-view: delegate to the standard formula unchanged. peekWidth:64 (set on
 * the component) is restored by applyMultiViewLayout and drives normal Enyo
 * slide behaviour there — calcFitWidth accounts for the slide offset so the
 * inner content div fills the screen with no gap.
 */
enyo.kind({
	name: "ereader.PeekingSlider",
	kind: enyo.SlidingView,
	contentPeek: 64,
	calcSlideAfter: function() {
		if (this.pane.isAnimating() || this.pane.dragging) return this.calcSlideMax();
		if (this.pane.multiView) {
			var a = this.pane.view;
			return a ? a.calcSlideMin() : 0;
		}
		return -this.contentPeek;
	}
});

/**
 * ereader.panels.MainPanels - Main navigation panels
 *
 * Multi-view (desktop/tablet): both panels slide natively via Enyo's fling
 * animation. peekWidth:64 means selecting the content panel shows 64 px of
 * library on the left — calcFitWidth stretches the inner content div to fill
 * the remaining screen width so there is no gray strip.
 *
 * Single-view (phone): PeekingSlider.calcSlideAfter keeps 64 px of the content
 * panel peeking from the right edge when the library is selected.
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
		{name: "contentPanel", peekWidth: 64, flex: 1, dragAnywhere: false, className: "content-panel", kind: "ereader.PeekingSlider", components: [
			{kind: "ereader.ContentNavigator", flex: 1, name: "itemView", onBookSelected: "doBookSelected", onSearchQueried: "onSearchQueried", onMarkupSelected: "onMarkupSelected", onCategorySelected: "handleContentViewCatChange", onAddCategorySelected: "handleAddCategorySelected"},
			{className: "drag-handle", onclick: "slideBtnClicked", name: "slideBtn"}
		]}
	],
	categoryId: "ereader-books-main",

	create: function() {
		this.inherited(arguments);
		if (window.innerWidth > window.innerHeight) {
			this._isLandscape = true;
			this.showLandscapeView(true);
		}
		else {
			this._isLandscape = false;
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
		this.$.slideBtn.show();
		this.resizeView();
	},

	showPortraitView: function(async) {
		this.$.slideBtn.show();
		this.selectContentView(async);
		this.resizeView();
	},

	handleWindowRotated: function(orientation) {
		// webOS passes "up"/"down" for landscape; the browser shim passes no
		// argument, so fall back to comparing viewport dimensions.
		var isLandscape = (orientation == "up" || orientation == "down" || window.innerWidth > window.innerHeight);

		// Browser resize events also fire this handler. Only re-select panels
		// when orientation actually flips; otherwise just reflow the grid so
		// the user's panel state is preserved across window resizes.
		if (isLandscape === this._isLandscape) {
			this.resizeView();
			return;
		}
		this._isLandscape = isLandscape;

		if (isLandscape) {
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
		if (async === true) {
			this.canAnimate = false;
		}
		this.selectView(this.$.contentPanel, async);
		if (async === true) {
			this.canAnimate = true;
		}
		this.$.libraryView.minimize();
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
