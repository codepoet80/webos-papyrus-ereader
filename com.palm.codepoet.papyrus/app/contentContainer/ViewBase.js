/**
 * ereader.contentContainer.ViewBase - Base view for book lists
 *
 * Simplified version that uses direct book data instead of MojoDB.
 * Uses manual component creation instead of Repeater.setCount() for Enyo 0.10 compatibility.
 */
enyo.kind({
	name: "ereader.contentContainer.ViewBase",
	kind: enyo.VFlexBox,
	events: {
		onBookSelected: "",
		onItemPressAndHold: ""
	},
	components: [
		{kind: "Scroller", flex: 1, name: "listScroller", showing: false, components: [
			{kind: "VFlexBox", name: "listContainer"}
		]},
		{kind: "Scroller", flex: 1, name: "gridScroller", components: [
			{kind: "Control", name: "gridContainer", className: "grid-container"}
		]},
		{name: "noBooksIndicator", layoutKind: "HFlexLayout", showing: false, className: "no-book-box", components: [
			{kind: "Spacer", flex: 1},
			{layoutKind: "VFlexLayout", components: [
				{kind: "Spacer", flex: 1},
				{layoutKind: "HFlexLayout", name: "emptyCollectionImgBox", components: [
					{kind: "Spacer", flex: 1},
					{kind: "Image", src: "images/empty-collection.png", align: "center"},
					{kind: "Spacer", flex: 1},
				]},
				{name: "noBooksMessageTxt", className: "empty-library-text", content: $L("No books in your library")},
				{className: "empty-library-subtext", content: $L("Tap 'Import ePub' to add books from your device")},
				{kind: "Spacer", flex: 1},
			]},
			{kind: "Spacer", flex: 1},
		]}
	],

	books: [],
	itemKind: "ereader.contentContainer.GridViewItem",

	create: function() {
		this.inherited(arguments);
		this.books = [];
		this.itemKind = "ereader.contentContainer.GridViewItem";
	},

	rendered: function() {
		this.inherited(arguments);
		// Block mouse-wheel scrolling on the library — wheel events sent the
		// grid off-screen with no obvious way to scroll back. Touch/drag scroll
		// still works for users with large libraries.
		var prevent = function(e) { e.preventDefault(); };
		var gridNode = this.$.gridScroller.hasNode();
		var listNode = this.$.listScroller.hasNode();
		if (gridNode) gridNode.addEventListener('wheel', prevent, { passive: false });
		if (listNode) listNode.addEventListener('wheel', prevent, { passive: false });
	},

	setBooks: function(books) {
		this.books = books || [];
		this.rebuildView();
	},

	setItemType: function(itemKind, rebuildNow) {
		if (this.itemKind !== itemKind) {
			this.itemKind = itemKind;
			if (rebuildNow === true) {
				this.rebuildView();
			}
		}
	},

	rebuildView: function() {
		if (this.books.length === 0) {
			this.showNoBooksIndicator();
			return;
		}

		this.hideNoBooksIndicator();

		if (this.itemKind === "ereader.contentContainer.GridViewItem") {
			this.rebuildGridView();
		} else {
			this.rebuildListView();
		}
	},

	rebuildGridView: function() {
		this.$.listScroller.hide();
		this.$.gridScroller.show();

		this.$.gridContainer.destroyControls();

		// Items are added flat — CSS flex-wrap handles reflowing into rows.
		// No JavaScript column calculation needed; covers have a fixed natural
		// size (120px + 30px margins = 150px per slot) and wrap automatically.
		for (var i = 0; i < this.books.length; i++) {
			this.$.gridContainer.createComponent({
				kind: "ereader.contentContainer.GridViewItem",
				book: this.books[i],
				onclick: "handleGridItemClick",
				onmousehold: "handleGridItemHold",
				owner: this
			});
		}
		this.$.gridContainer.render();
	},

	rebuildListView: function() {
		this.$.gridScroller.hide();
		this.$.listScroller.show();

		this.$.listContainer.destroyControls();

		for (var i = 0; i < this.books.length; i++) {
			this.$.listContainer.createComponent({
				kind: "ereader.contentContainer.ListViewItem",
				book: this.books[i],
				onclick: "handleListItemClick",
				onmousehold: "handleListItemHold",
				owner: this
			});
		}
		this.$.listContainer.render();
	},

	resize: function() {
		this.rebuildView();
	},

	handleListItemClick: function(inSender, inEvent) {
		if (inSender.book) {
			this.doBookSelected(inSender.book);
		}
	},

	handleListItemHold: function(inSender, inEvent) {
		if (inSender.book) {
			this.doItemPressAndHold(inSender.book);
		}
	},

	handleGridItemClick: function(inSender, inEvent) {
		if (inSender.book) {
			this.doBookSelected(inSender.book);
		}
	},

	handleGridItemHold: function(inSender, inEvent) {
		if (inSender.book) {
			this.doItemPressAndHold(inSender.book);
		}
	},

	showNoBooksIndicator: function() {
		this.$.noBooksIndicator.show();
		this.$.listScroller.hide();
		this.$.gridScroller.hide();
	},

	hideNoBooksIndicator: function() {
		this.$.noBooksIndicator.hide();
	}
});
