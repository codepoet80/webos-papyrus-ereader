enyo.kind({
	name: "ereader.reading.BookInfoPopup",
	kind: "Popup",
	events: {
		onActionSelected: ""
	},
	className: "pop-balloon bookinfo-popup white",
	scrim: false,
	modal: true,
	lazy: false,
	components: [
		{kind: "VFlexBox", name: "bookInfoActions", components: [
			{name: "cover", kind: "ereader.reading.BookInfoItem", actionName: $L("Cover"), onActionSelected: "handleActionSelection"},
			{name: "toc", kind: "ereader.reading.BookInfoItem", actionName: $L("Table of Contents"), onActionSelected: "handleActionSelection"},
			{name: "begin", kind: "ereader.reading.BookInfoItem", actionName: $L("Beginning"), onActionSelected: "handleActionSelection"},
			{name: "loc", kind: "ereader.reading.BookInfoItem", actionName: $L("Location..."), onActionSelected: "handleActionSelection"},
			{name: "markup", kind: "ereader.reading.BookInfoItem", actionName: $L("Notes and Marks"), onActionSelected: "handleActionSelection"}
		]},
		{className: "balloon-bottom"}
	],
	
	create: function() {
		this.inherited(arguments);
	},
	
	handleActionSelection: function(o) {
		this.doActionSelected(o.name);
	},
	
	setTocAvailability: function (available) {
		if (available) {
			this.$.toc.enable();
		}
		else {
			this.$.toc.disable();
		}
	}
});

enyo.kind({
	name: "ereader.reading.BookInfoItem",
	kind: enyo.Item,
	tapHighlight: false,
	className: "list-view-item",
	events: {
		onActionSelected: ""
	},	
	components: [
		{kind: "Control", name: "actionName", content: $L("All"), onclick: "handleActionSelection" },
		{name: "disableContent", content: $L("(Not available for this title)"), showing: false, style: "font-size: 12px;" }
	],
	
	create: function() {
		this.inherited(arguments);
		this.$.actionName.setContent(arguments[0].actionName);
		this.actionName = arguments[0].actionName;
		this.disabled = false;
	},
	
	disable: function () {
		this.disabled = true;
		this.addRemoveClass("disabled", true);
		this.$.disableContent.show();
		this.render();
	},
	
	enable: function () {
		this.disabled = false;
		this.addRemoveClass("disabled", false);
		this.$.disableContent.hide();
		this.render();
	},
	
	handleActionSelection: function(o) {
		if (!this.disabled) {
			this.doActionSelected(o.name);
		}
	}
});