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
			{name: "markup", kind: "ereader.reading.BookInfoItem", actionName: $L("Bookmarks"), onActionSelected: "handleActionSelection"},
			{name: "define", kind: "ereader.reading.BookInfoItem", actionName: $L("Define..."), onActionSelected: "handleActionSelection"},
			{name: "share", kind: "ereader.reading.BookInfoItem", actionName: $L("Share Page"), onActionSelected: "handleActionSelection"},
			// Hidden by default; shown only when the "Discuss with Claude" setting
			// is on AND the Claude Chat app is installed (BookReader gates this).
			{name: "claude", kind: "ereader.reading.BookInfoItem", actionName: $L("Discuss in Claude..."), onActionSelected: "handleActionSelection", showing: false}
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
	},

	// Show/hide the checkmark on the "Define..." item so the menu reflects
	// whether Define mode is currently active.
	setDefineChecked: function (checked) {
		this.$.define.setChecked(checked);
	},

	// Show/hide the "Discuss in Claude..." item.  Called by BookReader with the
	// combined gate (setting enabled AND Claude Chat installed AND on webOS).
	setClaudeAvailability: function (available) {
		this.$.claude.setShowing(available);
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

	// Mark the label when checked.  Uses webOS's own menu checkmark asset
	// (the same blue check the system menus use) as a right-aligned background
	// image, so it renders correctly on every platform and every theme — no
	// font-dependent glyph.
	setChecked: function (checked) {
		this.$.actionName.addRemoveClass("bookinfo-checked", checked);
	},

	handleActionSelection: function(o) {
		if (!this.disabled) {
			this.doActionSelected(o.name);
		}
	}
});