/**
 * ereader.contentContainer.ListViewItem - List view item for book entries
 *
 * Simplified version without Amazon-specific features.
 */
enyo.kind({
	name: "ereader.contentContainer.ListViewItem",
	kind: enyo.Item,
	layoutKind: "HFlexLayout",
	tapHighlight: false,
	pack: "center",
	align: "center",
	className: "list-view-item listItem",
	events: {
		onBookSelected: "",
		onPressAndHold: ""
	},
	published: {
		book: null
	},
	components: [
		{className: "coverBoxSmall", name: "itemInfo", components: [
			{kind: "Image", name: "coverImage", src: "images/item-cover-default-small.png", className: "coverImageSmall", onclick: "handleBookSelected"},
		]},
		{flex: 1, className: "authorTitleBlockList", components: [
			{name: "title", content: "", className: "book-title", allowHtml: true},
			{name: "author", content: "", className: "book-author", allowHtml: true},
			{layoutKind: "HLayout", name: "progressIconRow", className: "progress-row", showing: false, components: [
				{name: "completeIndicators", className: "completeIndicator"},
				{name: "incompleteIndicators", className: "incompleteIndicator"}
			]},
		]},
		{name: "date", content: "", className: "small-text", showing: false}
	],

	create: function() {
		this.inherited(arguments);
		this.g11nDateFmt = new enyo.g11n.DateFmt({date: 'medium'});
		if (this.book) {
			this.bookChanged();
		}
	},

	bookChanged: function() {
		if (!this.book) return;

		this.$.title.setContent(this.book.title || "");
		this.$.author.setContent(this.book.author || "");

		var coverPath = this.book.coverImagePath;
		if (!coverPath || coverPath.length === 0) {
			coverPath = "images/item-cover-default.png";
		}
		coverPath = coverPath.replace(/.png$/i, "-small.png").replace(/.jpg$/i, "-small.jpg");
		this.$.coverImage.setSrc(coverPath);

		// Show progress indicators if we have location info
		var locTotal = this.book.locationsTotal || 0;
		var locCompleted = this.book.locationsCompleted || 0;
		if (locTotal > 0) {
			this.$.progressIconRow.show();
			this.setProgressIndicators(locCompleted, locTotal);
		} else {
			this.$.progressIconRow.hide();
		}

		// Show last accessed date
		if (this.book.lastAccessed) {
			var date = new Date(this.book.lastAccessed);
			var relativeDateString = this.g11nDateFmt.formatRelativeDate ?
				this.g11nDateFmt.formatRelativeDate(date) :
				this.g11nDateFmt.format(date);
			var strTmp = new enyo.g11n.Template($L("Opened #{date}"));
			this.$.date.setContent(strTmp.evaluate({date: relativeDateString}));
			this.$.date.show();
		} else {
			this.$.date.hide();
		}
	},

	setupItem: function(book, searchText) {
		this.book = book;

		if (searchText && searchText.length > 0) {
			var pattern = new RegExp("(" + this.escapeRegex(searchText) + ")", "gi");
			this.$.title.setContent((book.title || "").replace(pattern, '<span style="background-color: #FFFF00">$1</span>'));
			this.$.author.setContent((book.author || "").replace(pattern, '<span style="background-color: #FFFF00">$1</span>'));
		} else {
			this.bookChanged();
		}
	},

	setProgressIndicators: function(completed, total) {
		var totalNum = Math.max(Math.min(total / 300, 30), 2);
		var completeNum = (completed / total) * totalNum;
		var compNumPx = Math.round(completeNum) * 9;
		var leftNumPx = Math.round(totalNum) * 9 - compNumPx;
		this.$.completeIndicators.applyStyle("width", compNumPx + "px");
		this.$.incompleteIndicators.applyStyle("width", leftNumPx + "px");
	},

	handleBookSelected: function() {
		this.doBookSelected(this.book);
	},

	mouseholdHandler: function(target, event) {
		this.doPressAndHold(event);
	},

	escapeRegex: function(str) {
		return (str + '').replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g, "\\$1");
	}
});
