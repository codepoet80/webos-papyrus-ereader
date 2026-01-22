enyo.kind({
	name: "ereader.ExpandingSearchBox",
	kind: enyo.HFlexBox,
	events: {
		onSearchQueried: "",
		onBoxExpanded: "",
		onBoxCollapsed: "",
		onSearchChanged: ""
	},
	components: [
		{kind: "SearchInput", className: "search-field", onblur: "handleBlur", onSearch: "handleOnSearch", flex: 1, name: "searchTextBox", onCancel: "clearSearch", onchange: "searchChanged", /*hint: $L("Search Library..."), */ showing: false, onkeypress: "testEnter"},
		{kind: "IconButton", name: "searchBoxShowBtn", className: "", icon: "images/menu-icon-search.png", onclick: "showSearchBox"}
	],
	
	create: function() {
		this.inherited(arguments);
		this.collapsible = true;
	},
	
	showSearchBox: function() {
		this.doBoxExpanded();
		this.$.searchTextBox.show();
		this.$.searchBoxShowBtn.hide();
		this.setCollapsible(false);
        this.$.searchTextBox.setSelection({start: 0, end: 100000});
	},
    
    /*setLibraryHint: function() {
        this.$.searchTextBox.setHint($L("Search Library..."));
        this.render();
    },
    
    setReaderHint: function() {
        this.$.searchTextBox.setHint($L("Search Book..."));
        this.render();
    }, */
	
	hideSearchBox: function() {
		if (this.collapsible) {
			this.doBoxCollapsed();
			this.$.searchTextBox.hide();
			this.$.searchBoxShowBtn.show();
		}
	},
	
	setValue: function(newVal) {
		this.$.searchTextBox.setValue(newVal);
	},
	
	// TODO: make published property
	setCollapsible: function(collapsible) {
		this.collapsible = collapsible;
		if (!collapsible && !this.$.searchTextBox.showing) {
			this.showSearchBox();
		}
	},

	handleBlur: function(inSender) {
		if (this.$.searchTextBox.getValue().length == 0){
			this.clearSearch();
			this.hideSearchBox();
		}
	},

	clearSearch: function(inSender) {
		this.setCollapsible(true);
        this.doSearchQueried(null);
        this.doSearchChanged(null);
	},
	
	searchInitiated: function(o) {
		var str = this.$.searchTextBox.getValue();
		// The following code will mimic iPad's search by removing special characters from the string
		// unless the special character is in the middle of a word:
		var pos = str.search(/^[^a-zA-Z0-9_]+/gi);

		while ((parseInt(pos)) != -1) {
			str = str.substring(0, pos) + str.substring(pos + 1, str.length);
			pos = str.search(/^[^a-zA-Z0-9_]+/gi);
		}

		pos = str.search(/[^a-zA-Z0-9_]+$/gi);

		while ((parseInt(pos)) != -1) {
			str = str.substring(0, pos) + str.substring(pos + 1, str.length);
			pos = str.search(/[^a-zA-Z0-9_]+$/gi);
		}

		pos = str.search(/[\s][^a-zA-Z0-9_\s]/gi);

		while ((parseInt(pos)) != -1) {
			str = str.substring(0, pos + 1) + str.substring(pos + 2, str.length);
			pos = str.search(/[\s][^a-zA-Z0-9_\s]/gi);
		}

		pos = str.search(/[^a-zA-Z0-9_\s][\s]/gi);

		while ((parseInt(pos)) != -1) {
			str = str.substring(0, pos) + str.substring(pos + 1, str.length);
			pos = str.search(/[^a-zA-Z0-9_\s][\s]/gi);
		}

		return str;
	},

	handleOnSearch: function(inSender) {
		var str = this.searchInitiated();
		if (str.length > 0) {
			this.doSearchQueried(str);
		}
		else {
			this.doSearchQueried(null);
		}
	},

	testEnter: function(inSender, key) {
		if (key.keyCode == 13) {
			//inSender.forceBlur();
			var str = this.searchInitiated();
			if (str.length > 0) {
				this.doSearchQueried(str);
			}
			else {
				this.doSearchQueried(null);
			}
            inSender.forceFocus();
		}
	},

	searchChanged: function(inSender, key) {
		var str = this.searchInitiated();
		if (str.length > 0) {
			this.doSearchChanged(str);
		}
		else {
			this.doSearchChanged(null);
		}
	}
});