/* ~~~ Global options ~~~ */
function Options() {
	//Loading some sane defaults
	this.loadDefaults();
	
	//Opening / Creating the DB and reading values
	this.optionsDB = new Mojo.Depot(
		{ name: "OptionsDB", replace: false },
		this.dbLoadData.bind(this), this.dbOpenFail.bind(this)
	);
}

Options.prototype.loadDefaults = function() {
	//Setting the flag that tells us that not everything is loaded yet
	this.loadCnt = 0;
	this.numOptions = 44;
	
	//The array of theme names
	this.themes = new Array();
	
	//The array of dictionary URLs & names
	this.dictionaries = [
		{ name: "Dictionary.com", url: "http://dictionary.reference.com/browse/$s" },
		{ name: "Merriam-Webster", url: "http://www.merriam-webster.com/dictionary/$s" },
		{ name: "Leo Dictionary", url: "http://dict.leo.org/ende?search=$s" },
		{ name: "Wikipedia (en)", url: "http://en.wikipedia.org/wiki/Special:Search?search=$s&go=Go" }
		
	];
	
	//Loading the app info
	this.appInfo = {
		version: null
	};
	var saveAppInfo = function(appInfo) {
		if (appInfo) {
			this.appInfo = appInfo;	
		} else {
			this.appInfo = false;
		}
	};
	this.getAppInfo(saveAppInfo.bind(this));
	
	this.lastSeenVersion = "0.0.0"; 
	
	this.textSize = 12;
	this.textItalic = false;
	this.textBold = false;
	this.textAlignment = 1;
	
	this.textColourType = 1;
	this.textColourHex = null;
		
	this.bgColourType = 1;
	this.bgColourHex = null;
	
	this.textFontSelection = 1;
	this.textFontName = null;
	this.textDirectionLTR = true;
	
	this.leaveDictMode = false;
	this.autoLoadLast = true;
	this.askTypeOnLoad = true;
	this.palmDocAlwaysPlain = false;
	
	
	//Scrolling with taps
	this.scrollModeTap = true;
	//Scrolling with flicks
	this.scrollModeFlick = false;
	this.scrollModeInvertLR = false;
	this.scrollModeInvertTap = false;
	//Scrolling with keys
	this.scrollModeKey = false;
	this.scrollModeKeyUp = null;
	this.scrollModeKeyDown = null;
	this.scrollModeKeyAutoScroll = null;
	//Scrolling with accelerometer tilt-flick
	this.scrollModeAccel = false;
	//The speed in lines/minute in autoscroll mode
	this.autoScrollSpeed = 30;
	this.autoScrollSmooth = false; //Whether to use smooth, or in-place autoscroll
	
	//Global smooth scroll enabled
	this.smoothScroll = false;
	
	//The landscape mode, default is 1 = auto
	this.landscapeMode = 1;
	
	//The default encoding; 5 = CP-1252 (Latin)
	this.encoding = 5;
	
	//Whether we use a belt-bar or not
	this.useBeltBar = true;
	//The assignments for the belt bar buttons
	this.beltBarButtonLeft = 1; //Bookmarks
	this.beltBarButtonRight = 2; //Autoscroll
	this.beltBarUsesPages = false;
	
	this.showSmallProgressBar = true;
	
	//Whether we use fullscreen or not
	this.useFullscreen = false;
	
	//Whether to use no master password (0), ask once (1) or always ask (2)
	this.masterKeyringMode = 1;
	//ATTENTION: The actual key should NEVER be stored on disk;
	//thus it also doesn't count towards "numOptions"
	this.masterKeyringKey = null;
	
	this.hideDefaultCategories = false;
	
	this.lastSelectedDictionary = -1;
	
	this.LibrarySort = 2;
	this.hideLibrarySort = false;
	this.reverseLibrarySort = false;
}

Options.prototype.readDbVar = function(name) {
	if (typeof(name) == "undefined" || name.length <= 0) return;
	this.optionsDB.get(
		name,
		function(name, data) {
			this.loadCnt+=1;
			if (data != null) this[name] = data;
		}.bind(this, name),
		function(name, error){
			this.loadCnt+=1;
			console.warn("Couldn't read " + name + " option. New DB?");
		}.bind(this, name)
	);
}

Options.prototype.dbLoadData = function() {
	//We retrieve the theme names
	this.readDbVar("themes");
	
	//And the dictionaries
	this.readDbVar("dictionaries");
	
	this.readDbVar("lastSeenVersion");
	
	//We try to retrieve the stored options
	this.readDbVar("textSize");
	this.readDbVar("textItalic");
	this.readDbVar("textBold");
	this.readDbVar("textAlignment");
	this.readDbVar("textColourType");
	this.readDbVar("textColourHex");
	
	this.readDbVar("bgColourType");
	this.readDbVar("bgColourHex");
	
	this.readDbVar("textFontSelection");
	this.readDbVar("textFontName");
	this.readDbVar("textDirectionLTR");
	
	this.readDbVar("leaveDictMode");
	this.readDbVar("autoLoadLast");
	this.readDbVar("askTypeOnLoad");
	this.readDbVar("palmDocAlwaysPlain");
	
	this.readDbVar("scrollModeTap");
	this.readDbVar("scrollModeFlick");
	this.readDbVar("scrollModeInvertLR");
	this.readDbVar("scrollModeInvertTap");
	this.readDbVar("scrollModeKey");
	this.readDbVar("scrollModeKeyUp");
	this.readDbVar("scrollModeKeyDown");
	this.readDbVar("scrollModeKeyAutoScroll");
	this.readDbVar("scrollModeAccel");
	this.readDbVar("autoScrollSpeed");
	this.readDbVar("autoScrollSmooth");
	this.readDbVar("smoothScroll");
	
	this.readDbVar("encoding");
	
	this.readDbVar("landscapeMode");
	
	this.readDbVar("useBeltBar");
	this.readDbVar("beltBarButtonLeft");
	this.readDbVar("beltBarButtonRight");
	this.readDbVar("beltBarUsesPages");
	
	this.readDbVar("showSmallProgressBar");
	
	this.readDbVar("useFullscreen");
	
	this.readDbVar("masterKeyringMode");
	
	this.readDbVar("hideDefaultCategories");
	
	this.readDbVar("lastSelectedDictionary");

	this.readDbVar("LibrarySort");
	this.readDbVar("hideLibrarySort");
	this.readDbVar("reverseLibrarySort");

}

Options.prototype.dbOpenFail = function(transaction, result) {
	this.loadCnt = Number.POSITIVE_INFINITY;
	var msg = "Can't open options database (#" +
			result.message + "). Sane defaults will be used."; 
    console.warn(msg); 
    Mojo.Controller.errorDialog(msg);
}; 

Options.prototype.dbSave = function() {
	this.optionsDB.add("themes", this.themes);
	
	this.optionsDB.add("dictionaries", this.dictionaries);
	
	this.optionsDB.add("lastSeenVersion", this.lastSeenVersion);
	
	this.optionsDB.add("textSize", this.textSize);
	this.optionsDB.add("textItalic", this.textItalic);
	this.optionsDB.add("textBold", this.textBold);
	this.optionsDB.add("textAlignment", this.textAlignment);
	
	this.optionsDB.add("textColourType", this.textColourType);
	this.optionsDB.add("textColourHex", this.textColourHex);
	
	this.optionsDB.add("bgColourType", this.bgColourType);
	this.optionsDB.add("bgColourHex", this.bgColourHex);
	
	this.optionsDB.add("textFontSelection", this.textFontSelection);
	this.optionsDB.add("textFontName", this.textFontName);
	this.optionsDB.add("textDirectionLTR", this.textDirectionLTR);
	
	this.optionsDB.add("leaveDictMode", this.leaveDictMode);
	this.optionsDB.add("autoLoadLast", this.autoLoadLast);
	this.optionsDB.add("askTypeOnLoad", this.askTypeOnLoad);
	this.optionsDB.add("palmDocAlwaysPlain", this.palmDocAlwaysPlain);
	
	this.optionsDB.add("scrollModeTap", this.scrollModeTap);
	this.optionsDB.add("scrollModeFlick", this.scrollModeFlick);
	this.optionsDB.add("scrollModeInvertLR", this.scrollModeInvertLR);
	this.optionsDB.add("scrollModeInvertTap", this.scrollModeInvertTap);
	
	this.optionsDB.add("scrollModeKey", this.scrollModeKey);
	this.optionsDB.add("scrollModeKeyUp", this.scrollModeKeyUp);
	this.optionsDB.add("scrollModeKeyDown", this.scrollModeKeyDown);
	this.optionsDB.add("scrollModeKeyAutoScroll", this.scrollModeKeyAutoScroll);
	this.optionsDB.add("scrollModeAccel", this.scrollModeAccel);
	this.optionsDB.add("autoScrollSpeed", this.autoScrollSpeed);
	this.optionsDB.add("autoScrollSmooth", this.autoScrollSmooth);
	this.optionsDB.add("smoothScroll", this.smoothScroll);
	
	this.optionsDB.add("encoding", this.encoding);
	
	this.optionsDB.add("landscapeMode", this.landscapeMode);
	
	this.optionsDB.add("useBeltBar", this.useBeltBar);
	this.optionsDB.add("beltBarButtonLeft", this.beltBarButtonLeft);
	this.optionsDB.add("beltBarButtonRight", this.beltBarButtonRight);
	this.optionsDB.add("beltBarUsesPages", this.beltBarUsesPages);

	this.optionsDB.add("showSmallProgressBar", this.showSmallProgressBar);

	this.optionsDB.add("useFullscreen", this.useFullscreen);
	
	this.optionsDB.add("masterKeyringMode", this.masterKeyringMode);
	
	this.optionsDB.add("hideDefaultCategories", this.hideDefaultCategories);
	
	this.optionsDB.add("lastSelectedDictionary", this.lastSelectedDictionary);

	this.optionsDB.add("LibrarySort", this.LibrarySort);
	this.optionsDB.add("hideLibrarySort", this.hideLibrarySort);
	this.optionsDB.add("reverseLibrarySort", this.hideLibrarySort);

}

Options.prototype.isReady = function() {
	console.log(
		"Load Count is " + this.loadCnt +
		"; AppInfo.version is " + this.appInfo.version
	);
	return this.loadCnt >= this.numOptions && !(this.appInfo.version === null); 
}

Options.prototype.getTextStyling = function() {
	var style=""
	style += "font-size:" + this.textSize + "pt";
	style += ";text-align:";
	switch (this.textAlignment) {
		default:
		case 1: style += "justify"; break;
		case 2: style += "left"; break;
		case 3: style += "right"; break;
		case 4: style += "center"; break;
	}
	if (this.textBold == true) { style += ";font-weight:bold"; }
	if (this.textItalic == true) { style += ";font-style:italic"; }
	
	var colour = this.getColourFromCode(this.textColourType, this.textColourHex);
	if (colour && colour != null && colour.length > 0) {
		style += ";color:" + colour;
	}
	
	var font = this.getFontFromCode(this.textFontSelection, this.textFontName);
	if (font && font != null && font.length > 0) {
		style += ";font-family:\'" + font + "\'";
	}
	
	//Checking if we want right-to-left text
	if (this.textDirectionLTR == false) { style += ";direction:rtl;unicode-bidi:embed"; }
	
	return style;
}

Options.prototype.getTextColour = function() {
	return this.getColourFromCode(this.textColourType, this.textColourHex);
}

Options.prototype.getBackgroundStyling = function() {
	if (!this.bgColourType || this.bgColourType == null) {
		return "";
	}
	var colour = this.getColourFromCode(this.bgColourType, this.bgColourHex);
	if (colour.length <= 0) { colour = "#E4E4E2"; }
	if (colour && colour != null && colour.length > 0) {
		return "background-color:" + colour;		
	} else {
		return "";
	}
}

Options.prototype.getColourFromCode = function (code, custom) {
	var colour = "";
	switch (code) {
		case 1: break;
		case 2: colour = "#FFFFFF"; break;
		case 3: colour = "#000000"; break;
		case 4: colour = "#DED5AC"; break;
		case 5: colour = "#DCDCDC"; break;
		case 6: colour = "#C0C0C0"; break;
		case 7: colour = "#808080"; break;
		case 8: colour = custom; break;
	}
	return colour;
}

Options.prototype.getFontFromCode = function (code, custom) {
	var font = "";
	switch (code) {
		case 1: break;
		case 2: font = "Times New Roman"; break;
		case 3: font = "Verdana"; break;
		case 4: font = "Coconut"; break;
		case 6: font = "Courier New"; break;
		case 5: font = custom; break;
	}
	return font;
}

Options.prototype.changeAutoScrollSpeed = function(newSpeed) {
	//Setting a sane new speed
	this.autoScrollSpeed =
		(newSpeed > 120) ? 120 :
		(newSpeed < 0) ? 0 :
		Math.floor(newSpeed);
}

// ~~~ Theming functions ~~~

Options.prototype.getThemes = function() {
	var ret = new Array();
	for (var i = 0; i < this.themes.length; i+=1) {
		ret.push(this.themes[i]);
	}
	return ret;
}

Options.prototype.loadTheme = function(name, callback) {
	console.log("loadTheme: " + name);
	//Ensuring that callback is callable
	if (typeof(callback) == "undefined" || callback == null) {
		callback = function() {};
	}
	this.optionsDB.get(
		"themeData" + name,
		function(name, callback, data) {
			if (data != null) {
				this.assignTheme(data, callback);
			} else {
				callback(false);
			}
		}.bind(this, name, callback),
		function(name, callback, error) {
			console.warn("Couldn't load theme " + name + ".");
			callback(false);
		}.bind(this, name, callback)
	);
}

Options.prototype.saveCurrAsTheme = function(name, callback) {
	console.log("saveCurrAsTheme: " + name);
	//Ensuring that callback is callable
	if (typeof(callback) == "undefined" || callback == null) {
		callback = function() {};
	}
	//We check if there's already a theme with that name
	var pos = this.themes.indexOf(name);
	if (pos < 0) {
		//We add the theme to the name array
		this.themes.push(name);
	}
	//Creating the object we want to save (a copy of this)
	var saveObj = new Object;
	for (property in this) {
		switch(property) {
			//Ignored fields
			case "optionsDB": case "loadCnt": case "numOptions":
				break;
			//Everything else is stored
			default:
				saveObj[property] = this[property];
				break;
		}
	}
	//And we save the current options as a theme
	this.optionsDB.add("themeData" + name, saveObj,
		callback.bind(this, true),
		callback.bind(this, false) //TODO: Upon failure, we should tell the user
	);
}

Options.prototype.removeTheme = function(name, callback) {
	console.log("removeTheme: " + name);
	//Ensuring that callback is callable
	if (typeof(callback) == "undefined" || callback == null) {
		callback = function() {};
	}
	//We check if there's already a theme with that name
	var pos = this.themes.indexOf(name);
	if (pos < 0) {
		//No theme to delete
		callback(false);
		return;
	}
	//We kill the theme from our list
	this.themes.splice(pos, 1);
	//And we save the current options as a theme
	this.optionsDB.discard("themeData" + name,
		callback.bind(this, true),
		callback.bind(this, false) //TODO: Upon failure, we should tell the user
	);
}

/**
 * This method overwrites the current options with data from
 * the given theme and then calls the callback.
 * You should not call this from the outside.
 * @param {Object} theme the Theme (an Options object) to load
 * @param {Object} callback the function that's called upon completion
 */
Options.prototype.assignTheme = function(theme, callback) {
	console.log("assignTheme: " + theme);
	var assign = function (theme, valName) {
		if (typeof(theme[valName]) != "undefined") {
			this[valName] = theme[valName];
		}
	}.bind(this);
	//We assign *some* of the stored variables.
	//There's just no point in theming some of the options
	assign(theme, "textSize");
	assign(theme, "textItalic");
	assign(theme, "textBold");
	assign(theme, "textAlignment");
	
	assign(theme, "textColourType");
	assign(theme, "textColourHex");
		
	assign(theme, "bgColourType");
	assign(theme, "bgColourHex");
	
	assign(theme, "textFontSelection");
	assign(theme, "textFontName");
	assign(theme, "textDirectionLTR");
	
	//The landscape mode, default is 1 = auto
	assign(theme, "landscapeMode");
	
	//Whether we use a belt-bar or not
	assign(theme, "useBeltBar");

	//Whether we use fullscreen or not
	assign(theme, "useFullscreen");
	
	//At the end, we call the callback
	if (typeof(callback) != "undefined" && callback != null) {
		callback(true);		
	}
}


// ~~~ Misc. Data Reading ~~~

Options.prototype.getAppInfo = function(callback) {
	console.log("getAppInfo()");
	var readAppInfo = function(callback, file) {
		console.log("readAppInfo()");
		if (!file) {
			callback(null);
		}
		var data = bytesToString(file.read(0, file.getLength()));
		//Parsing the JSON
		//console.log("appinfo = " + data);
		var appInfo = Mojo.parseJSON(data);
		callback(appInfo);
	};
	new File("appinfo.json", readAppInfo.bind(this, callback));
};


// ~~~ The global options object ~~~
globalOptions = new Options();