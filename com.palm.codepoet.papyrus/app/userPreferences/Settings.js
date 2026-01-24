/**
 * ereader.userPreferences.Settings - Settings popup
 *
 * Simplified version without Amazon account management.
 */
enyo.kind({
	name: "ereader.userPreferences.Settings",
	kind: "Popup",
	scrim: true,
	lazy: false,
	className: "settingsBox",
	width: "400px",
	style: "padding: 20px; height: 450px;",
	components: [
		{kind: "VFlexBox", style: "height: 100%;", components: [
			{content: $L("Settings"), className: "loginFormTitle"},
			{kind: "Scroller", style: "height: 340px;", components: [
				{kind: "VFlexBox", components: [
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{content: $L("Basic reading mode"), flex: 1},
							{kind: "ToggleButton", name: "animBtn", state: false, onChange: "saveAnimationChange"},
						]},
						{content: $L("Simplified page turning and other animations"), className: "loginFormDescription"},
					]},
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{content: $L("Default theme"), flex: 1},
							{kind: "ListSelector", name: "themeSelector", onChange: "saveThemeChange", items: [
								{caption: $L("White"), value: 0},
								{caption: $L("Sepia"), value: 1},
								{caption: $L("Black"), value: 2}
							]}
						]},
					]},
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{content: $L("Default font"), flex: 1},
							{kind: "ListSelector", name: "fontSelector", onChange: "saveFontChange", items: [
								{caption: $L("Georgia"), value: 0},
								{caption: $L("Verdana"), value: 1}
							]}
						]},
					]},
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{content: $L("Default font size"), flex: 1},
							{kind: "ListSelector", name: "fontSizeSelector", onChange: "saveFontSizeChange", items: [
								{caption: $L("Small (14)"), value: 14},
								{caption: $L("Medium (18)"), value: 18},
								{caption: $L("Large (22)"), value: 22},
								{caption: $L("Extra Large (26)"), value: 26}
							]}
						]},
					]},
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{content: $L("Volume buttons turn pages"), flex: 1},
							{kind: "ToggleButton", name: "volumeKeysBtn", state: false, onChange: "saveVolumeKeysChange"},
						]},
						{content: $L("This feature works best when audio is muted."), className: "loginFormDescription"},
					]},
					{kind: "RowGroup", style: "margin-top: 20px;", components: [
						{kind: "Button", content: $L("Clear Library"), className: "enyo-button-negative", onclick: "confirmClearLibrary"},
					]},
				]},
			]},
			{kind: "HFlexBox", style: "margin-top: 10px;", components: [
				{kind: "Button", flex: 1, content: $L("OK"), className: "enyo-button-dark", onclick: "close"}
			]},
		]},
		{kind: "Popup", name: "confirmPopup", scrim: true, components: [
			{content: $L("Are you sure you want to clear your library? This will remove all books and annotations."), style: "width: 300px; margin: 10px; word-wrap: break-word;"},
			{kind: "HFlexBox", flex: 1, components: [
				{kind: "Button", flex: 1, content: $L("Clear"), onclick: "clearLibrary", className: "enyo-button-dark"},
				{kind: "Button", flex: 1, content: $L("Cancel"), onclick: "dismissConfirmPopup", className: "enyo-button-light"}
			]}
		]}
	],

	create: function() {
		this.inherited(arguments);
		this.loadSettings();
	},

	openAtCenter: function() {
		this.inherited(arguments);
		this.loadSettings();
	},

	loadSettings: function() {
		try {
			var settings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			this.$.animBtn.setState(settings.basicReadingMode || false);
			this.$.themeSelector.setValue(settings.currentTheme || 0);
			this.$.fontSelector.setValue(settings.currentFontType || 0);
			this.$.fontSizeSelector.setValue(settings.currentFontSize || 18);
			this.$.volumeKeysBtn.setState(settings.volumeKeyPageTurn || false);
		} catch (e) {
			this.log("Error loading settings: " + e);
		}
	},

	saveSettings: function(key, value) {
		try {
			var settings = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
			settings[key] = value;
			localStorage.setItem("ereader_settings", JSON.stringify(settings));
		} catch (e) {
			this.log("Error saving settings: " + e);
		}
	},

	saveAnimationChange: function() {
		this.saveSettings("basicReadingMode", this.$.animBtn.getState());
	},

	saveThemeChange: function(inSender) {
		this.saveSettings("currentTheme", inSender.getValue());
	},

	saveFontChange: function(inSender) {
		this.saveSettings("currentFontType", inSender.getValue());
	},

	saveFontSizeChange: function(inSender) {
		this.saveSettings("currentFontSize", inSender.getValue());
	},

	saveVolumeKeysChange: function() {
		this.saveSettings("volumeKeyPageTurn", this.$.volumeKeysBtn.getState());
	},

	confirmClearLibrary: function() {
		this.$.confirmPopup.openAtCenter();
	},

	dismissConfirmPopup: function() {
		this.$.confirmPopup.close();
	},

	clearLibrary: function() {
		this.$.confirmPopup.close();
		this.close();  // Close settings popup
		try {
			localStorage.removeItem("ereader_library");
			localStorage.removeItem("ereader_annotations");
			localStorage.removeItem("ereader_categories");
			// Notify the app to refresh and rescan for books
			if (window.EReaderApp && window.EReaderApp.refreshLibrary) {
				window.EReaderApp.refreshLibrary();
			}
		} catch (e) {
			this.log("Error clearing library: " + e);
		}
	}
});
