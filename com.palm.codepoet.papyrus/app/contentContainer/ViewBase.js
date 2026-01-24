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
			{kind: "VFlexBox", name: "gridContainer"}
		]},
		{name: "noBooksIndicator", layoutKind: "HFlexLayout", showing: false, className: "no-book-box", components: [
			{kind: "Spacer", flex: 1},
			{layoutKind: "VFlexLayout", components: [
				{kind: "Spacer", flex: 1},
				{layoutKind: "HFlexLayout", name: "emptyCollectionImgBox", showing: false, components: [
					{kind: "Spacer", flex: 1},
					{kind: "Image", src: "images/empty-collection.png", align: "center"},
					{kind: "Spacer", flex: 1},
				]},
				{name: "noBooksMessageTxt", className: "empty-library-text", content: $L("No books in your library")},
				{className: "empty-library-subtext", content: $L("Press the button to 'Import ePub' files")},
				{className: "empty-library-subtext", style: "margin-top: 10px;", content: $L("Place ePub files in /media/internal/ebooks/")},
				{kind: "Spacer", flex: 1},
			]},
			{kind: "Spacer", flex: 1},
		]}
	],

	books: [],
	itemKind: "ereader.contentContainer.GridViewItem",
	gridColumns: 4,

	create: function() {
		this.inherited(arguments);
		this.books = [];
		this.itemKind = "ereader.contentContainer.GridViewItem";
		this.calculateGridColumns();
	},

	calculateGridColumns: function() {
		var width = window.innerWidth;
		if (width > 900) {
			this.gridColumns = 5;
		} else if (width > 700) {
			this.gridColumns = 4;
		} else {
			this.gridColumns = 3;
		}
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

		var rowCount = Math.ceil(this.books.length / this.gridColumns);
		for (var row = 0; row < rowCount; row++) {
			var rowComponents = [];
			for (var col = 0; col < this.gridColumns; col++) {
				var bookIndex = row * this.gridColumns + col;
				if (bookIndex < this.books.length) {
					rowComponents.push({
						kind: "ereader.contentContainer.GridViewItem",
						book: this.books[bookIndex],
						onclick: "handleGridItemClick",
						onmousehold: "handleGridItemHold",
						owner: this,
						flex: 1
					});
				} else {
					rowComponents.push({kind: "Control", flex: 1});
				}
			}
			this.$.gridContainer.createComponent({
				kind: "HFlexBox",
				className: "grid-row",
				components: rowComponents
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
		this.calculateGridColumns();
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
