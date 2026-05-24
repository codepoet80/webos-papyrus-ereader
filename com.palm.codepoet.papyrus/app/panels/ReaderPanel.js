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
	},
	// enyo-build.js applySlideToNode only sets node.style.webkitTransform.
	// In Firefox the JS write API style.webkitTransform is a no-op (only CSS
	// -webkit-transform is accepted; the JS setter is not mapped).  Override to
	// also write the unprefixed node.style.transform so panel positioning works
	// in Firefox and any other browser where the webkit JS setter is not wired up.
	// PeekingSlider is always the content panel (index > 0), so we unconditionally
	// mirror whatever transform was computed after delegating to the base method.
	applySlideToNode: function(a) {
		this.inherited(arguments);
		// Mirror the transform without the webkit prefix.
		// this.slidePosition is now up-to-date (set by inherited).
		if (this.hasNode()) {
			var pos = this.slidePosition;
			this.node.style.transform = (pos !== null && pos !== undefined)
				? "translate3d(" + pos + "px,0,0)"
				: "";
		}
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
	className: "reader-panel",
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

	// Width threshold that matches SlidingPane's multiViewMinWidth.
	// Above this: multi-view (library + content side by side).
	// Below this: single-view (one panel at a time, phone style).
	multiViewThreshold: 500,

	// Returns true when the layout should show both panels side by side.
	// On webOS: use physical orientation (width > height is reliable on a device).
	// On desktop browsers: use the SlidingPane width threshold instead, so the
	// panel-selection logic stays in sync with the SlidingPane's own multi/single
	// view switching and doesn't flip when the browser window happens to be square.
	isWideLayout: function() {
		if (window.PalmSystem) {
			return window.innerWidth > window.innerHeight;
		}
		return window.innerWidth > this.multiViewThreshold;
	},

	create: function() {
		this.inherited(arguments);
		if (this.isWideLayout()) {
			this._isLandscape = true;
			this.showLandscapeView(true);
		}
		else {
			this._isLandscape = false;
			this.showPortraitView(true);
		}
	},

	// rendered() fires after the DOM is fully built and Enyo has completed its
	// first resize/layout pass (resize() runs inside SlidingPane.rendered()).
	// create() calls showPortraitView() above, but at that point offsetLeft values
	// may still be 0 (DOM not yet measured) so transforms can be wrong.
	// This deferred call re-applies the portrait selection after the browser has
	// had time to measure and paint the initial layout, ensuring the content panel
	// is correctly positioned at narrow widths.
	rendered: function() {
		this.inherited(arguments);
		var self = this;
		setTimeout(function() {
			if (!self.isWideLayout() && self.view !== self.$.contentPanel) {
				enyo.log("ReaderPanel.rendered: deferred portrait correction");
				self.showPortraitView(true);
			}
		}, 100);
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

	// resizeHandler is the Enyo entry point called on every browser window resize.
	// SlidingPane.resizeHandler calls this.resize() which toggles this.multiView at
	// the 500px threshold, but it does NOT re-select panels — the selected panel
	// stays wherever it was.  Override: after the parent handles layout, detect a
	// multi-view flip and switch to the appropriate panel automatically so the user
	// always sees content on narrow screens and the library/content split on wide ones.
	resizeHandler: function() {
		var wasMultiView = this.multiView;
		this.inherited(arguments);  // SlidingPane.resizeHandler: resize() + child broadcast
		enyo.log("ReaderPanel.resizeHandler: wasMultiView=" + wasMultiView + " nowMultiView=" + this.multiView + " innerWidth=" + window.innerWidth);
		if (this.multiView !== wasMultiView) {
			if (this.multiView) {
				this.showLandscapeView(true);
			} else {
				this.showPortraitView(true);
			}
		}
	},

	handleWindowRotated: function(orientation) {
		// webOS only: PalmSystem.screenOrientation changes to "up"/"down" for
		// landscape.  In browsers this event is NEVER dispatched (sendOrientationChange
		// checks orientation !== lastOrientation and both are always undefined),
		// so resizeHandler() above handles all browser resize logic instead.
		var isLandscape = (orientation == "up" || orientation == "down" || this.isWideLayout());

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
