
/**
 * Creates a new, empty Library Entry.
 */
function LibraryEntry() {
	//The unique ID of this entry
	this.uid = "0";
	//The category of this entry
	this.category = null;
	//The name that is used for display and library-access
	this.name = null;
	//The formatting string that determines how the name is created
	this.format = "%t";
	//The name of the HTMLBook that is used for actual storage
	this.bookDbName = null;
	//The current reading position in the book, expressed in bytes
	this.currReadingPos = 0;
	//The total length of the book
	this.length = 1;
	
	//The encoding type used; defaults to the global encoding param
	this.encoding = globalOptions.encoding;
	
	//The array of bookmarks
	this.bookmarks = new Array();
	
	// ~~~ Optional fields ~~~
	//The name of the author
	this.author = null;
	//The title of the book
	this.title = null;
	//The publisher of the book
	this.publisher = null;
	//The language of the book
	this.language = null;
	//The expire date, it's a UTC date as gained from Date.toUTCString()
	this.expireDate = null;
}


LibraryEntry.prototype.getSaveState = function() {
	console.log("LibraryEntry: getSaveState");
	var stringify = function(id) {
		//console.log("LibraryEntry: stringify : " + id);
		var str = this[id];
		return (str == null) ? "" : escape(str);
	}.bind(this);
	
	var state = "";
	state += stringify("uid") + ";";
	state += stringify("category") + ";";
	state += stringify("name") + ";";
	state += stringify("format") + ";";
	state += stringify("bookDbName") + ";";
	state += stringify("currReadingPos") + ";";
	state += stringify("length") + ";";
	state += stringify("encoding") + ";";
	
	state += (this.bookmarks.length * 2) + ";"
	for (var i = 0; i < this.bookmarks.length; i+=1) {
		state += escape(this.bookmarks[i].label) + ";";
		state += this.bookmarks[i].position + ";";
	}
	
	state += stringify("author") + ";";
	state += stringify("title") + ";";
	state += stringify("publisher") + ";";
	state += stringify("language") + ";";
	
	state += stringify("expireDate") + ";";
	
	return state;
}

LibraryEntry.prototype.loadSaveState = function(state) {
	console.log("LibraryEntry: loadSaveState");
	//At first, we split along ";"
	var fields = state.split(";");
	var i = 0;
	
	var decString = function(data) {
		if (data == null || data.length <= 0) {
			return null;
		} else {
			return unescape(data);
		}
	}
	
	if (i < fields.length) this.uid = parseInt(fields[i++]);
	if (i < fields.length) this.category = decString(fields[i++]);
	if (i < fields.length) this.name = decString(fields[i++]);
	if (i < fields.length) this.format = decString(fields[i++]);
	if (i < fields.length) this.bookDbName = decString(fields[i++]);
	if (i < fields.length) this.currReadingPos = parseInt(fields[i++]);
	if (i < fields.length) this.length = parseInt(fields[i++]);
	if (i < fields.length) this.encoding = parseInt(fields[i++]);
	
	//Parsing the bookmarks
	if (i >= fields.length) { return false; }
	var end = i + parseInt(fields[i]); i++;
	this.bookmarks = new Array();
	if (end < fields.length) {
		for (; i <= end; i+= 2) {
			var label = decString(fields[i]);
			var pos = parseInt(fields[i+1]);
			if (label != null) {
				this.bookmarks.push(new Bookmark(label, pos));				
			}
		}		
	} else {
		//Invalid bookmarks array
		return false;
	}
	
	//Now, we exclusively parse optional fields, that means we always return true
	
	if (i < fields.length) this.author = decString(fields[i++]);
	if (i < fields.length) this.title = decString(fields[i++]);
	if (i < fields.length) this.publisher = decString(fields[i++]);
	if (i < fields.length) this.language = decString(fields[i++]);
	
	if (i < fields.length) this.expireDate = decString(fields[i++]);
	
	return true;
}

/**
 * A simple comparator for LibraryEntries.
 * Only returns 0 when the two objects are the same object.
 * @param {Object} a
 * @param {Object} b
 */
LibraryEntry.comparator = function(a, b){
	if (a.name == b.name && a == b) {
		return 0;
	} else {
		var aname = 0;
		var bname = 0;	
		
		switch (globalOptions.LibrarySort) {
			case 1: //Author
				aname = a.author;
				bname = b.author;
				break;
			case 2: //Name
				aname = a.name;
				bname = b.name;
				break;
			case 3: //Category
				aname = a.cathegory;
				bname = b.cathegory;
				break;
			case 4: //Publisher
				aname = a.publisher;
				bname = b.publisher;
				break;
			case 5: //Language
				aname = a.language;
				bname = b.language;
				break;
			case 6: //Read %
				aname = a.currReadingPos / a.length;
				bname = b.currReadingPos / b.length;
				break;
			default:
				aname = a.name;
				bname = b.name;
				break;
		}		
		if (globalOptions.reverseLibrarySort) {
			if (aname < bname) {
				return 1;
			}
			else if (aname == bname) {
				return 0;
			} else {
				return -1;
			}
		}
		else {
			if (aname < bname) {
				return -1;
			}
			else if (aname == bname) {
				return 0;
			} else {
				return 1;
			}
		}
	}
}

/**
 * Returns true if at least one of the metadata fields
 * matches the given string. This search is case insensitive.
 * @param {String} string the string that should be matched.
 */
LibraryEntry.prototype.matches = function(string) {
	var str = string.toLowerCase();
	return (
		(this.author && this.author.toLowerCase().indexOf(str) >= 0) ||
		(this.title && this.title.toLowerCase().indexOf(str) >= 0) ||
		(this.publisher && this.publisher.toLowerCase().indexOf(str) >= 0) ||
		(this.language && this.language.toLowerCase().indexOf(str) >= 0)
	);
}

function Bookmark(label, position) {
	this.label = label;
	this.position = position;
}

