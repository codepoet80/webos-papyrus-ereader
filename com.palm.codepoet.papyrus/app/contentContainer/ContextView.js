enyo.kind({
	name: "kindle.contentContainer.ContextViewItem", 
	kind: enyo.Item,
	tapHighlight: false,
	flex: 1,
	domStyles: { padding: "10px 10px 10px 10px" },
	events: {
		onBookSelected: ""
	},
	components: [
		{kind: "HFlexBox", flex: 1,  components: [
			{kind: "HFlexBox", flex: 1, onclick: "handleBookSelected",  components: [
				{kind: "Image", name: "coverImage", src: "images/books/1984.jpg", className: "coverImageLarge"},
			
				{kind: "VFlexBox", flex: 1, className: "authorTitleBlockContext",  components: [
					{name: "title", content: "Nineteen Eighty-Four", className: "book-title"},
					{name: "author", content: "Orson Welles", className: "book-author"},
					{name: "excerpt", className: "bookExcerpt", content: "It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith, his chin nuzzled into his breast in an effort to escape the vile wind, slipped quickly through the glass..." },
					
					{kind: "HFlexBox", components: [
						{name: "progressImg", kind: "Image", src: "images/item-icon-in-progress.png", domStyles: { padding: "0px 10px 0 0" } },
						{name: "date", content: "Last opened: 2:15 yesterday", className: "lastDateText small-text" }
					]}
				]}
			]},
			{kind: "VFlexBox", className: "markupBuyBtnBlock", align: "right", components: [
				{name: "markupBtn", className: "", align: "right", kind: "IconButton", icon: "images/item-icon-markup.png"},
				{name: "buyBtn", className: "enyo-button-light", kind: "Button", content: $L("Buy")}
			]}
		]}
	],
	
	create: function() {
		this.inherited(arguments);
		this.$.title.setContent(arguments[0].title);
		this.$.author.setContent(arguments[0].author);
		this.$.coverImage.src = arguments[0].coverImagePath;
		this.$.coverImage.srcChanged();
		this.bookFilePath = arguments.bookFilePath;
		if (this.isSample)
		{
			this.$.buyBtn.show();
		}
		else
		{
			this.$.buyBtn.hide();
		}
		if (this.isArchived == "true") {
			this.applyStyle("opacity", 0.2);
		}
	},
	
	buyBtnClick: function() {
	},
	
	handleBookSelected: function(o) {
		this.doBookSelected(this.title);
	}
});
