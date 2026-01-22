/**
 * ereader.contentContainer.GridViewItem - Grid view item for book covers
 *
 * Simplified version without Amazon-specific features.
 */
enyo.kind({
	name: "ereader.contentContainer.GridViewItem",
	kind: enyo.Control,
	className: "coverBoxLarge gridItem",
	events: {
		onBookSelected: ""
	},
	published: {
		book: null
	},
	components: [
		{kind: "Image", name: "coverImage", src: "images/item-cover-default-medium.png", className: "coverImageLarge", onclick: "handleBookSelected"},
		{name: "title", className: "grid-book-title", content: "", showing: false},
		{name: "numMarkupsContainer", className: "numMarkupsContainer markupsBannerLarge numMarkups", onclick: "handleBookSelected", showing: false, content: "0"},
	],

	create: function() {
		this.inherited(arguments);
		if (this.book) {
			this.bookChanged();
		}
	},

	bookChanged: function() {
		if (!this.book) return;

		var coverPath = this.book.coverImagePath;
		if (!coverPath || coverPath.length === 0) {
			coverPath = "images/item-cover-default.png";
		}

		// Show title if using default cover
		if (coverPath === "images/item-cover-default.png") {
			this.$.title.setContent(this.book.title || "");
			this.$.title.show();
		} else {
			this.$.title.hide();
		}

		// Try medium size image
		coverPath = coverPath.replace(/.png$/i, "-medium.png").replace(/.jpg$/i, "-medium.jpg");
		this.$.coverImage.setSrc(coverPath);

		// Show markup count if any
		var numMarkups = this.book.numMarkups || 0;
		if (numMarkups > 0) {
			this.$.numMarkupsContainer.setContent(numMarkups);
			this.$.numMarkupsContainer.show();
		} else {
			this.$.numMarkupsContainer.hide();
		}
	},

	setupItem: function(book) {
		this.book = book;
		this.bookChanged();
	},

	handleBookSelected: function() {
		this.doBookSelected(this.book);
	}
});
