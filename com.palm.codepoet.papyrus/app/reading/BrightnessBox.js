enyo.kind({
	name: "ereader.reading.BrightnessBox",
	kind: "Popup",
	className: "pop-balloon brightness-popup white",
	events: {
	},
	scrim: false,
	modal: true,
	components: [
		{kind: "HFlexBox", flex: 1, align:"center", components: [
			{className: "balloon-top"},
			{kind: "IconButton", icon: "images/reading-lessBrightness-icon.png", onclick:"dimmerClicked", style:"margin:-3px 14px 0", className:""},
			{kind: "Slider", name: "brightnessSlider", animatePosition: true, onChange:"onBrightnessChanged", tapPosition: true, position: 50, maximum: 100, minimum: 0, width: "180px"},
			{kind: "IconButton", icon: "images/reading-moreBrightness-icon.png", onclick:"brighterClicked", style:"margin:-3px 14px 0", className:""},
			{name: "BrightnessService", kind: "PalmService", service: "palm://com.palm.display/control/"}
		]}
	],
	
	componentsReady: function () {
		this.inherited(arguments);

		// 60 is the average brightness:
		this.SystemBrightness = 60;

		this.getSystemBrightness();
	},
	
	onBrightnessChanged : function (inSender){
		var value = inSender.position;
		this.changeBrightness(value);
	},
	changeBrightness : function (value) {
		this.$.BrightnessService.call({
		maximumBrightness: parseInt(value)
	},{
		method: "setProperty",
		onSuccess: "onBrightnessChangedSuccess",
		onFailure: "onBrightnessChangedFailure"
	});
	},
	onBrightnessChangedSuccess : function (inSender, inResponse) {
	},
	onBrightnessChangedFailure : function (inSender, inResponse) {
		alert ("brightness failure");
		alert (inResponse.errorText);

		this.message(inSender.getName() + " FAIL: " + inResponse.errorText, "#FF8080");
		this.message("MaximumBrightness:" + Response.maximumBrightness);
		this.message("Brightness:" + Response.brightness);
	},
	brighterClicked : function (inSender){
		//this.$.brightnessSlider.setPosition(this.$.brightnessSlider.position + 5);
		var brightnessValue;
		brightnessValue = this.$.brightnessSlider.position + 5;

		if (brightnessValue <= 100) {
			this.changeBrightness(brightnessValue);
			this.$.brightnessSlider.setPositionImmediate(brightnessValue);
		}
		this.$.brightnessSlider.setPositionImmediate(brightnessValue);
	},
	dimmerClicked : function (inSender) {
		//this.$.brightnessSlider.setPosition(this.$.brightnessSlider.position - 5);
		var brightnessValue;
		brightnessValue = this.$.brightnessSlider.position - 5;

		if (brightnessValue >= 0) {
			this.changeBrightness(brightnessValue);
			this.$.brightnessSlider.setPositionImmediate(brightnessValue);
		}
	},
	
	getSystemBrightness: function () {
		this.$.BrightnessService.call({
			properties: ["maximumBrightness"]
		},{
			method: "getProperty",
			onSuccess: "gotSystemBrightness",
			onFailure: "gotSystemBrightnessFailure"
		});	
	},

	gotSystemBrightnessFailure : function (inSender){
		this._openIfNeeded();
	},

	gotSystemBrightness : function (inSender, inResponse) {
		this.SystemBrightness = inResponse.maximumBrightness;
		if (this.SystemBrightness <= 10) {
			this.$.brightnessSlider.setPositionImmediate(0);
		} else {
			this.$.brightnessSlider.setPositionImmediate(this.SystemBrightness);
		}
		this._openIfNeeded();
	},
	
	openPopup: function () {
		if (this.$.BrightnessService) {
			this.getSystemBrightness();
			this.openOnGotSysBrightness = true;
		} else {
			this.open();
		}
	},
	
	_openIfNeeded:function () {
		if (this.openOnGotSysBrightness === true) {
			this.openOnGotSysBrightness = false;
			this.open();
		}	
	}
});
