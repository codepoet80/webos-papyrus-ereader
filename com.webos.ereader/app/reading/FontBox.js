enyo.kind({
	name: "ereader.reading.FontBox",
	kind: "Popup",
	className: "pop-balloon font-popup white",
	events: {
		onTypeSelection: "",
		onFontSizeChanged: "",
		onReaderThemeChanged: ""
	},
	scrim: false,
	modal: true,
	lazy: false,
	scrimClassName: "clear-scrim",
	components: [
		{className: "balloon-top"},
		{kind: "RadioGroup", name:"typeSelector", className: "font-style-controls", onChange:"handleTypeSelection", components : [
			{ kind: "RadioButton", name:"serif", label : $L("Georgia"), value: 0},
			{ kind: "RadioButton", name:"sansSerif", label : $L("Verdana"), value: 1}
		]},
		{className:"hr-border", domStyles: {margin: "20px 0 10px"}},
		{kind: "RadioGroup", name:"colorSelector", className: "font-theme-controls", onChange:"handleThemeChanged", components : [
			{ kind: "RadioButton", name:"blackOnWhite", icon: "images/reading-font-buttons.png", className: "black-on-white", value: 0},
			{ kind: "RadioButton", name:"sepia", icon: "images/reading-font-buttons.png", className: "sepia", value: 1},
			{ kind: "RadioButton", name:"whiteOnBlack", icon: "images/reading-font-buttons.png", className: "white-on-black", value: 2}
		]},
		{className:"hr-border", domStyles: {margin: "10px 0 0"}},
		{kind:"HFlexBox",  align:"center", className:"font-size-box", components: [
			{kind: "IconButton", name: "smallerBtn", onclick: "onReduceFont", icon: "images/reading-font-smaller.png", style:"margin:-6px 14px 0", className: ""},
			{kind: "Slider", name: "sizeSlider", onChange:"onSizeSliderChanged", tapPosition: true, position: 0, maximum: 32, minimum: 12, width: "120px"},
			{kind: "IconButton", name: "biggerBtn", onclick: "onIncreaseFont", icon: "images/reading-font-larger.png", style:"margin:-6px 14px 0", className: ""}
		]}
	],
	
	create: function() {
		this.inherited(arguments);
	},
	
	rendered: function(){
        this.inherited(arguments);
    },

	handleTypeSelection : function(inSender) {
		this.doTypeSelection(inSender.getValue());
	},
	
	setFontSize: function(fontSize) {
		if (typeof(fontSize) === "string") {
			fontSize = parseInt(fontSize);
		}
		if (typeof(fontSize) !== "number") {
			throw "Error, Invalid fontSize type: " + fontSize + " (type: " + typeof(fontsize) + ")";
		}
		this.fontSize = fontSize;
		this.$.sizeSlider.setPositionImmediate(this.fontSize);
	},
	
	setFontType: function(type) {
		this.$.typeSelector.setValue(type);
	},
	
	setTheme: function(theme) {
		this.$.colorSelector.setValue(theme);
	},
	
	onReduceFont : function() {		
		if(this.fontSize >= 13) {
			this.fontSize = this.fontSize - 1;
			this.$.sizeSlider.setPositionImmediate(this.fontSize);
			this.doFontSizeChanged(this.fontSize);
		}
	},
	
	onIncreaseFont : function() {		
		if(this.fontSize <= 31) {
			this.fontSize = this.fontSize + 1;
			this.$.sizeSlider.setPositionImmediate(this.fontSize);
			this.doFontSizeChanged(this.fontSize);
		}
	},
	
	onSizeSliderChanged: function(sender,intPos){
		this.log(intPos);
		this.fontSize = intPos;
		this.doFontSizeChanged(this.fontSize);
	},
	
	handleThemeChanged : function(inSender) {
		this.doReaderThemeChanged(inSender.getValue());
	}
});