enyo.kind({
	name: "ereader.top_row",
	kind: "VFlexBox",
	showing: true,
	events: {
		onLibrarySelected: "",
		onPageManipulation: "",
		onSearchQueried: "",
		onTypeSelection: "",
		onFontSizeChanged: "",
		onReaderThemeChanged: "",
		onSearchBoxCollapsed: ""
	},
	windowRotated: "changeBookTitleLayout",
	className: "book-reader-top white",
	components: [
		{kind:"HFlexBox", align:'center', pack: 'justify', className: "top-row-bar", components: [
			{kind:"HFlexBox", className: "book-reader-top-left", components: [
				{kind:"IconButton", name:"library", icon:"images/reader-icon-library.png", className:"", style: "z-index: 5;", onclick:"callLibrarySelected"},
			]},
			{name: "bookTitle", content: "", className: "reading-book-title small-text truncate"},
			{kind:"HFlexBox", align:'center', pack:'center', className: "book-reader-top-right", components: [
				{kind:"VFlexBox", name: "fontContainer", components: [
					{name: "fontCtrl", kind: "IconButton", icon:"images/reader-icon-font.png", className:"", onclick: "onFont"},
				]},
				{kind:"VFlexBox", name: "brightnessContainer", components: [
					{kind: "IconButton", icon: "images/reader-icon-brightness.png", onclick: "onBrightness", className:""},
				]},
				{kind: "ereader.ExpandingSearchBox", name: "searchBox", className: "reader-search-box", onSearchQueried: "handleSearchQueried", onBoxExpanded: "handleSearchSelected", onBoxCollapsed: "handleSearchDeselected"},
			]},
		]},
		{nodeTag: "hr", domStyles: {margin: "0px 0 -2px 50px", "z-index": "105"}},
		{kind:"ereader.reading.BrightnessBox", name: "brightnessBox"},
		{kind:"ereader.reading.FontBox", name: "fontBox", onTypeSelection: "doTypeSelection", onFontSizeChanged: "doFontSizeChanged", onReaderThemeChanged: "doReaderThemeChanged"}
	],
	
	create: function() {
		this.inherited(arguments);
	},
	
	handleSearchQueried : function(insender, searchText) {
		if (searchText != null) {
			console.log("Search Query " + searchText);
			this.$.searchBox.$.searchTextBox.forceBlur();
			this.doSearchQueried(searchText);
		}
	},
	
	setFontSize: function(size) {
		this.$.fontBox.setFontSize(size);
	},
	
	setFontType: function(type) {
		this.$.fontBox.setFontType(type);
	},
	
	setTheme: function(theme) {
		this.$.fontBox.setTheme(theme);
	},
	
	handleSearchSelected : function() {
		this.$.brightnessContainer.hide();
		this.$.fontContainer.hide();
	},
	
	handleSearchDeselected : function() {
		this.$.brightnessContainer.show();
		this.$.fontContainer.show();
		this.doSearchBoxCollapsed();
	},
	
	isSearchBoxOpen: function() {
		return !this.$.searchBox.collapsible;
	},
	
	onFont : function() {
		this.$.fontBox.open();
	},
	
	onBrightness : function() {
		this.$.brightnessBox.openPopup();		
	},
	
	onPrev : function(insender) {
		this.doPageManipulation("prev");
	},
	
	onNext : function(insender) {			
		this.doPageManipulation("next");
	},
	
	handleWindowRotated: function(orientation) {
		if (orientation == "up" || orientation == "down") {
			this.$.bookTitle.addClass("landscape");
		}
		else {
			this.$.bookTitle.removeClass("landscape");
		}
	},
	
	callLibrarySelected: function() {
		console.log("top_row: callLibrarySelected called");
		this.doLibrarySelected();
		console.log("top_row: doLibrarySelected fired");
	},
	
	changeBookTitleLayout: function(o, orientation) {
		if (orientation == "left" || orientation == "right") {
			if(!this.$.progressBar.hasClass("landscape")) {
				this.$.progressBar.addClass("landscape"); 
			}
		} else {
			if(!this.$.progressBar.hasClass("landscape")) {
				this.$.progressBar.removeClass("landscape"); 
			}
		}
	},

	changeCSSClassesTo: function (theclass) {
		this.removeClass("sepia");
		this.removeClass("white");
		this.removeClass("black");
		this.addClass(theclass);
		this.$.brightnessBox.removeClass("sepia");
		this.$.brightnessBox.removeClass("white");
		this.$.brightnessBox.removeClass("black");
		this.$.brightnessBox.addClass(theclass);
		this.$.fontBox.removeClass("sepia");
		this.$.fontBox.removeClass("white");
		this.$.fontBox.removeClass("black");
		this.$.fontBox.addClass(theclass);
	}
});