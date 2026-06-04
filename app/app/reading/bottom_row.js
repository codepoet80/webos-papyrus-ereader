/**
 * ereader.bottom_row - Reader bottom toolbar
 *
 * Simplified version without Amazon sync functionality.
 */
enyo.kind({
	name: "ereader.bottom_row",
	kind: "Control",
	height: "58px",
	showing: true,
	className: "white",
	events: {
		onLocationSelected: "",
		onSlideOutSelected: "",
		onTOCSelected: "",
		onPreviousLocationSelected: "",
		onSharePage: ""
	},
	components: [
		{nodeTag: "hr", className:"hr-bottom"},
		{kind:"HFlexBox", className: "book-reader-bottom", components: [
			{kind:"IconButton", name:"previousLocBtn", icon:"images/reader-icon-prev-loc.png", className: "back-button", onclick:"handlePreviousLocationSelected", disabled: true},
			{kind: "HFlexBox", flex: 1, className: "location-info-bar", components: [
				{name: "locationText1", content: "Location 1", className: "location-text location-text-full small-text"},
				{kind:"HFlexBox", className:"location-slider", flex: 1, components: [
					{kind: "Slider", flex: 1, name: "progressSlider", tapPosition: true, animatePosition: true, onChanging:"handleSliderLocationChanging", onChange:"handleSliderLocationChanged", maximum: 500, minimum:1, position: 1},
				]},
				{name: "locationText2", content: "0%", className: "location-text location-text-left small-text", onclick: "handlePercentClick"}
			]},
			{kind: "Control", components: [
				{kind: "ereader.reading.BookInfoPopup", name: "bookMenu", onActionSelected: "handleBookAction"},
				{kind:"IconButton", name:"bookMenuBtn", icon:"images/reader-icon-book-info.png", className: "", onclick:"onBookMenuClick"}
			]},
		]},
		{kind: "Popup", name: "locationPopup", scrim: true, lazy: false, scrimClassName: "", onClose: "dismissPopup", components: [
			{content: "Enter location (1-100):", name: "enterLocTxt"},
			{kind: "Input", name: "location", autoKeyModifier: "num-lock", onkeypress: "testEnter", onchange: "onLocInputChange", changeOnInput: true},
			{content: "Current location: 1", name: "currentLocTxt"},
			{kind: "HFlexBox", flex: 1, components: [
				{kind: "Button", flex: 1, name: "cancel", onclick: "dismissPopup", className: "enyo-button-light button-label", content: $L("Cancel")},
				{kind: "Button", flex: 1, name: "okBtn", onclick: "sendLocationInfo", className: "enyo-button-light button-label", content: $L("OK")}
			]}
		]},
		{kind: "Popup", name: "percentPopup", scrim: true, lazy: false, scrimClassName: "", onClose: "dismissPercentPopup", components: [
			{content: "Go to percentage (0–100):", name: "enterPctTxt"},
			{kind: "Input", name: "percentInput", autoKeyModifier: "num-lock", onkeypress: "testPercentEnter", onchange: "onPctInputChange", changeOnInput: true},
			{kind: "HFlexBox", flex: 1, components: [
				{kind: "Button", flex: 1, name: "cancelPct", onclick: "dismissPercentPopup", className: "enyo-button-light button-label", content: $L("Cancel")},
				{kind: "Button", flex: 1, name: "okPctBtn", onclick: "sendPercentInfo", className: "enyo-button-light button-label", content: $L("OK")}
			]}
		]}
	],

	create: function () {
		this.inherited(arguments);
		this.numfmt = new enyo.g11n.NumberFmt({style: "percent"});
		this.bottomLocationControlsUsed = false;
		this.totalLocations = 100;
	},

	onBookMenuClick: function(insender) {
		this.$.bookMenu.toggleOpen();
	},

	handleBookAction: function(insender, action) {
		this.$.bookMenu.close();
		switch (action) {
			case "cover":
				this.doSlideOutSelected("cover");
				break;
			case "toc":
				this.doTOCSelected();
				break;
			case "begin":
				this.doLocationSelected(0);
				break;
			case "loc":
				this.$.locationPopup.openAtCenter();
				this.$.locationPopup.children[1].forceFocus();
				break;
			case "markup":
				this.doSlideOutSelected("markups");
				break;
			case "share":
				this.doSharePage();
				break;
			default:
				break;
		}
	},

	setTotalLocations: function(totalLocations) {
		this.totalLocations = totalLocations || 100;
	},

	setLocationInfo: function(startLoc) {
		var strTmp = new enyo.g11n.Template($L("Location: #{start} of #{end}"));
		this.$.locationText1.setContent(strTmp.evaluate({start: startLoc, end: this.totalLocations}));
		var percent = Math.round((startLoc/this.totalLocations)*100);
		this.$.progressSlider.setPositionImmediate(percent*5);
		this.$.locationText2.setContent(this.numfmt.format(percent));
		strTmp = new enyo.g11n.Template($L("Current location: #{start}"));
		this.$.currentLocTxt.setContent(strTmp.evaluate({start: startLoc}));
		strTmp = new enyo.g11n.Template($L("Enter location: 1-#{end}"));
		this.$.enterLocTxt.setContent(strTmp.evaluate({end: this.totalLocations}));
		this.curLocationValue = "";
	},

	sendLocationInfo: function() {
		var loc = this.$.locationPopup.children[1].getValue();
		if (loc.length > 0) {
			this.doLocationSelected(parseInt(loc));
		}
		this.dismissPopup();
	},

	dismissPopup: function() {
		this.$.location.setValue("");
		this.$.locationPopup.close();
	},

	setTocAvailable: function(available) {
		this.$.bookMenu.setTocAvailability(available);
	},

	handlePreviousLocationSelected: function(inSender) {
		this.bottomLocationControlsUsed = true;
		this.doPreviousLocationSelected();
	},

	handleSliderLocationChanged: function(inSender) {
		var selectedPos = inSender.position;
		var totalNumPages = this.totalLocations;
		var newLoc;

		this.bottomLocationControlsUsed = true;

		if (selectedPos != 1) {
			newLoc = Math.round((totalNumPages/500)*selectedPos);
		} else {
			newLoc = 1;
		}

		console.log("bottom_row: slider changed, pos=" + selectedPos + ", newLoc=" + newLoc + ", total=" + totalNumPages);
		this.doLocationSelected(newLoc);
	},

	handleSliderLocationChanging: function(inSender) {
		var newLoc;

		if (inSender.position != 1) {
			newLoc = Math.round((this.totalLocations/500)*inSender.position);
		} else {
			newLoc = 1;
		}

		var strTmp = new enyo.g11n.Template($L("Location: #{start} of #{end}"));
		this.$.locationText1.setContent(strTmp.evaluate({start: newLoc, end: this.totalLocations}));
		this.$.locationText2.setContent(this.numfmt.format(Math.round((newLoc/this.totalLocations)*100)));
	},

	changeCSSClassesTo: function(theclass) {
		this.removeClass("sepia");
		this.removeClass("white");
		this.removeClass("black");
		this.addClass(theclass);
		this.$.locationPopup.removeClass("sepia");
		this.$.locationPopup.removeClass("white");
		this.$.locationPopup.removeClass("black");
		this.$.locationPopup.addClass(theclass);
		this.$.percentPopup.removeClass("sepia");
		this.$.percentPopup.removeClass("white");
		this.$.percentPopup.removeClass("black");
		this.$.percentPopup.addClass(theclass);
		this.$.bookMenu.removeClass("sepia");
		this.$.bookMenu.removeClass("white");
		this.$.bookMenu.removeClass("black");
		this.$.bookMenu.addClass(theclass);
	},

	enableHistoryBack: function() {
		this.$.previousLocBtn.setDisabled(false);
	},

	disableHistoryBack: function() {
		this.$.previousLocBtn.setDisabled(true);
	},

	testEnter: function(inSender, key) {
		if (key.keyCode == 13) {
			inSender.forceBlur();
			this.sendLocationInfo();
		}
	},

	onLocInputChange: function(inSender) {
		var curVal = this.$.location.getValue();
		var curLen = curVal ? curVal.length : 0;
		var filteredVal = undefined;

		if (curLen > 0) {
			filteredVal = curVal.replace(/[^\d]/, '');
			if (filteredVal.length === curLen) {
				var filteredValInt = parseInt(filteredVal);
				if (filteredValInt === 0) {
					filteredVal = "";
				} else if (filteredValInt > this.totalLocations) {
					this.$.location.setValue(this.curLocationValue);
					filteredVal = undefined;
				} else {
					filteredVal = undefined;
				}
			}
		}

		if (filteredVal !== undefined) {
			if (filteredVal.length === 0) {
				enyo.asyncMethod(this, "_clearLocation");
			} else {
				this.$.location.setValue(filteredVal);
				this.curLocationValue = this.$.location.getValue();
			}
		} else {
			this.curLocationValue = this.$.location.getValue();
		}
	},

	_clearLocation: function() {
		this.$.location.setValue("");
		this.curLocationValue = "";
	},

	// -------------------------------------------------------
	// Percentage-jump popup (used on phone where slider is hidden)
	// -------------------------------------------------------

	handlePercentClick: function() {
		this.$.percentPopup.openAtCenter();
		this.$.percentInput.forceFocus();
	},

	sendPercentInfo: function() {
		var raw = this.$.percentInput.getValue();
		if (raw && raw.length > 0) {
			var pct = parseInt(raw, 10);
			if (!isNaN(pct)) {
				pct = Math.max(0, Math.min(100, pct));
				var loc = Math.round((pct / 100) * this.totalLocations);
				this.doLocationSelected(loc);
			}
		}
		this.dismissPercentPopup();
	},

	dismissPercentPopup: function() {
		this.$.percentInput.setValue("");
		this.$.percentPopup.close();
	},

	testPercentEnter: function(inSender, key) {
		if (key.keyCode === 13) {
			inSender.forceBlur();
			this.sendPercentInfo();
		}
	},

	onPctInputChange: function(inSender) {
		var curVal = inSender.getValue();
		if (!curVal) return;
		var filtered = curVal.replace(/[^\d]/g, '');
		if (filtered !== curVal) {
			inSender.setValue(filtered);
			return;
		}
		var num = parseInt(filtered, 10);
		if (!isNaN(num) && num > 100) {
			inSender.setValue("100");
		}
	}
});
