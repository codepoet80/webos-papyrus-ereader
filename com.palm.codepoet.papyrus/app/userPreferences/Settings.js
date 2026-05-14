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
	style: "padding: 20px; height: 560px;",
	components: [
		{kind: "VFlexBox", style: "height: 100%;", components: [
			{content: $L("Settings"), className: "loginFormTitle"},
			{kind: "Scroller", style: "height: 450px;", components: [
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
							{content: $L("Keep screen on while reading"), flex: 1},
							{kind: "ToggleButton", name: "keepScreenOnBtn", state: false, onChange: "saveKeepScreenOnChange"},
						]},
					]},
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{content: $L("Volume buttons turn pages"), flex: 1},
							{kind: "ToggleButton", name: "volumeKeysBtn", state: false, onChange: "saveVolumeKeysChange"},
						]},
						{content: $L("This feature works best when audio is muted."), className: "loginFormDescription"},
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
					{kind: "RowGroup", style: "margin-top: 20px;", components: [
						{kind: "Button", content: $L("Clear Library"), className: "enyo-button-negative", onclick: "confirmClearLibrary"},
					]},
					{content: $L("Sync"), className: "loginFormTitle", style: "margin-top: 20px; font-size: 16px;"},
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{content: $L("Sync reading position"), flex: 1},
							{kind: "ToggleButton", name: "syncEnabledBtn", state: false, onChange: "saveSyncEnabled"},
						]},
						{content: $L("Syncs your furthest read position via WebDAV"), className: "loginFormDescription"},
					]},
					{kind: "RowGroup", components: [
						{content: $L("WebDAV URL"), className: "loginFormDescription"},
						{kind: "Input", name: "syncUrlInput", hint: "https://server/remote.php/webdav", onchange: "saveSyncUrl", autocorrect:false, spellCheck: false, autoCapitalize: "lowercase", autoComplete: false},
					]},
					{kind: "RowGroup", components: [
						{content: $L("Username"), className: "loginFormDescription"},
						{kind: "Input", name: "syncUserInput", hint: "username", onchange: "saveSyncUser", autocorrect: false, spellCheck: false, autoCapitalize: "lowercase", autoComplete: false},
					]},
					{kind: "RowGroup", components: [
						{content: $L("Password"), className: "loginFormDescription"},
						{kind: "PasswordInput", name: "syncPassInput", hint: "password", onchange: "saveSyncPass"},
					]},
					{kind: "RowGroup", components: [
						{kind: "HFlexBox", components: [
							{kind: "Button", flex: 1, content: $L("Test Connection"), onclick: "testSyncConnection"},
							{name: "syncStatus", content: "", flex: 2, style: "padding: 8px; font-size: 13px;"},
						]},
					]},
				]},
			]},
			{kind: "HFlexBox", style: "margin-top: 10px;", components: [
				{kind: "Button", flex: 1, content: $L("OK"), className: "enyo-button-dark", onclick: "saveAndClose"}
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
			this.$.keepScreenOnBtn.setState(settings.keepScreenOnReading || false);
			this.$.syncEnabledBtn.setState(settings.syncEnabled || false);
			this.$.syncUrlInput.setValue(settings.syncUrl || "");
			this.$.syncUserInput.setValue(settings.syncUser || "");
			this.$.syncPassInput.setValue(settings.syncPass || "");
			this.$.syncStatus.setContent("");
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

	saveKeepScreenOnChange: function() {
		this.saveSettings("keepScreenOnReading", this.$.keepScreenOnBtn.getState());
	},

	saveAndClose: function() {
		// Flush text input values before closing (onchange may not fire if OK tapped immediately)
		this.saveSettings("syncUrl",  this.$.syncUrlInput.getValue());
		this.saveSettings("syncUser", this.$.syncUserInput.getValue());
		this.saveSettings("syncPass", this.$.syncPassInput.getValue());
		this.close();
	},

	saveSyncEnabled: function() {
		this.saveSettings("syncEnabled", this.$.syncEnabledBtn.getState());
	},

	saveSyncUrl: function() {
		this.saveSettings("syncUrl", this.$.syncUrlInput.getValue());
	},

	saveSyncUser: function() {
		this.saveSettings("syncUser", this.$.syncUserInput.getValue());
	},

	saveSyncPass: function() {
		this.saveSettings("syncPass", this.$.syncPassInput.getValue());
	},

	testSyncConnection: function() {
		var url  = this.$.syncUrlInput.getValue();
		var user = this.$.syncUserInput.getValue();
		var pass = this.$.syncPassInput.getValue();
		this.$.syncStatus.setContent("Testing...");
		var self = this;
		PapyrusSyncManager.testConnection(url, user, pass, function(ok, err) {
			self.$.syncStatus.setContent(ok ? "Connected!" : ("Failed: " + (err || "unknown error")));
		});
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
