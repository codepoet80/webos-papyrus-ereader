
/**
 * Creates / loads a Library with the given Database name. 
 * @param {String} dbname the name of the database that is backing the library. 
 */
function Library(dbName, callback) {
	//Sanity check
	if (!dbName || dbName.length <= 0) {
        console.error("Library must have a DB Name.");
        return;
    }
	if (!callback || callback == null) {
        console.error("Library must have an onLoad callback.");
        return;
    }
	
	this.dbName = dbName;
	this.callback = callback;
	this.entries = new Array();
	
	this.maxUID = 0;
	
	this.isReady = false;
	
	//A variable storing the currently loaded book
	this.currLoadBook = null;
	
	//Loading the database
	this.libDB = new Database(
		"ext:" + dbName, 1, this.dbOpen.bind(this)
	);
}

Library.prototype.dbOpen = function() {
	//console.log("Library: dbOpen");
	//Trying to load the library index from the DB
	this.libDB.read(
		"libIndex",
		function(index) {
			//Checking if an index was present
			if (index != null && index.length > 0) {
				/* We decode the index, which is an array of numbers,
				 * the UIDs of the books; separated by ";"
				 */
				var uids = index[0].split(";");
				//The last "UID" is actually the highest UID we've given out
				this.maxUID = parseInt(uids.pop());
				if (isNaN(this.maxUID)) { this.maxUID = 0 };						
				//Now, we use the UIDs to fetch the actual book data
				this.loadEntries(uids);
			} else {
				//It is an entirely new & empty DB!
				//this.save();
				this.isReady = true;
				//We call the callback, since we're ready
				this.callback(this);
			}
		}.bind(this)
	);
}

Library.prototype.loadEntries = function(uids) {
	//console.log("Library: loadEntries");
	//We check if there are still uids to load
	if (!(uids) || uids.length <= 0) {
		//We're done, we set ourselves ready and call the callback
		this.isReady = true;
		this.callback(this);
		return;
	}
	//Otherwise, we fetch the last, valid UID from the list
	do {
		//Checking if we should abort
		if (uids.length <= 0) {
			this.isReady = true;
			this.callback(this);
			return;
		}
		var uid = uids.pop();
	} while (typeof(uid) == "undefined" || uid == null || uid.length <= 0);
	
	//Now, we fetch the data associated with that UID, decode the entry and call ourselves
	this.libDB.read(
		"t" + uid,
		function(uids, data) {
			//Checking if the entry-data was present
			if (data != null && data.length > 0) {
				//We decode the library entry from that data
				var entry = new LibraryEntry();
				var success = entry.loadSaveState(data[0]);
				if (success) {
					//Adding the entry to the im-memory lib
					this.entries.push(entry);
				}
			}
			//At the end, we load the next entry
			this.loadEntries(uids);
		}.bind(this, uids)
	);
}

/**
 * Saves the entire database, or if specified only the
 * library index and the entries with the given UIDs.
 * @param {Object} uids (optional) the UIDs of the entries that
 * 		should be written back to the disk. If empty or null,
 * 		ONLY the metadata is saved. If undefined, EVERYTHING
 * 		is saved.
 */
Library.prototype.save = function(uids) {
	this.libDB.verifyConnection(this.doSave.bind(this,uids));
}
Library.prototype.doSave = function(uids) {
	//We remove the reference to the currently loaded book
	this.currLoadBook = null;
	
	//Checking if we should only write back some entries
	var mode = 0; //We default to save only metadata
	if (typeof(uids) == "undefined") {
		//We want to save everything
		mode = 1;
	} else if (uids != null && uids.length > 0) {
		//We want to save only a given list of entries
		mode = 2;
	}
	
	var highUID = 0;
	var index = "";
	for (var i = 0; i < this.entries.length; i+=1) {
		var entry = this.entries[i];
		//We find the highest given UID
		index += entry.uid + ";";
		var uid = parseInt(entry.uid);
		if (!isNaN(uid) && uid >= highUID) {
			highUID = uid + 1;
		}
		//Checking if that entry should be written back
		if (mode == 1 || (mode == 2 && uids.indexOf(entry.uid) >= 0)) {
			//We don't *care* if saving is succesful or not
			this.libDB.write("t" + entry.uid,
				entry.getSaveState()
			);
		}
	}
	//We add the high UID as the maximum UID. NO SEMICOLON for the index-entry!
	this.maxUID = highUID;
	index += highUID;
	//At the end, we write out the index
	this.libDB.write("libIndex", index);
}

Library.prototype.addBook = function(bookName, reader, isPlainText, callback) {
	//console.log("addBook called");
	//Creating the anonymous function for creation
	var createFunct = function(entry, isPlainText, callback) {
		//Creating an HTMLBook for that reader
		this.currLoadBook = new HTMLBook(
			reader, isPlainText, entry.bookDbName,
			this.addEntry.bind(this, entry, callback)
		);
	}
	
	//Creating an entry
	var entry = new LibraryEntry();
	//The UID is set
	entry.uid = this.maxUID++;
	//The books saving name is set and also interpreted as the title
	entry.name = bookName;
	entry.title = bookName;
	entry.bookDbName = entry.name.replace(/[ \t]/g, "");
	
	//Now, we add the metadata, if present
	if (reader.getMetadata) {
		var meta = reader.getMetadata();
		if (meta.title) { entry.title = meta.title; }
		if (meta.author) { entry.author = meta.author; }
		if (meta.publisher) { entry.publisher = meta.publisher; }
		if (meta.language) { entry.language = meta.language; }
		if (meta.title && meta.author) {
			entry.format = "%a - %t";
		}
	}
	
	//We check if we need to add an expire date
	if (reader.getExpireDate) {
		var date = reader.getExpireDate();
		if (date != null) {
			entry.expireDate = date.toUTCString();
		}
	}
	
	//We remove any entry with the same bookName and call creation afterward
	this.removeBook(bookName, createFunct.bind(this, entry, isPlainText, callback));
}

Library.prototype.addEntry = function(entry, callback, book) {
	//console.log("addEntry called");
	//Checking if the book could be created
	if (book == null) { callback(null); }
	
	//Adding the length of the book to the entry
	entry.length = book.getLength();
	
	//Adding the entry to the array
	this.entries.push(entry);
	//Saving the library (only meta + entry) -- will reset this.currLoadBook 
	this.save([entry.uid]);
	//And calling the callback with the created entry
	callback(entry);
}

Library.prototype.getLoadProgress = function() {
	if (typeof(this.currLoadBook) == "undefined" || this.currLoadBook == null) {
		return 0.0;		
	} else {
		//We return the load progress of the book
		return this.currLoadBook.getLoadProgress();
	}
}

Library.prototype.getCategories = function() {
	var categories = new Array();
	for (var i = 0; i < this.entries.length; i+=1) {
		var cat = this.entries[i].category;
		if (cat != null && !categories.include(cat)) {
			categories.push(cat);
		}
	}
	return categories.sort();
}

Library.prototype.getBooksForCategory = function(category) {
	var ret = new Array();
	for (var i = 0; i < this.entries.length; i+=1) {
		var cat = this.entries[i].category;
		if (cat == category) {
			ret.push(this.entries[i]);
		}
	}
	return ret.sort(LibraryEntry.comparator);
}

Library.prototype.getBooks = function() {
	return this.entries.clone().sort(LibraryEntry.comparator);
}

Library.prototype.getBook = function(bookName) {
	for (var i = 0; i < this.entries.length; i+=1) {
		var name = this.entries[i].name;
		if (name == bookName) {
			return this.entries[i];
		}
	}
	return null;
}

Library.prototype.removeBook = function(bookName, callback) {
	for (var i = 0; i < this.entries.length; i+=1) {
		var name = this.entries[i].name;
		if (name == bookName) {
			var entry = this.entries[i];
			//Deleting the book of that entry
			HTMLBook.deleteBook(entry.bookDbName, callback);
			this.entries.splice(i,1);
			//We drop the entry from the disk
			this.libDB.remove("t" + entry.uid);
			//And saving JUST the metadata
			this.save(null);
			return true;
		}
	}
	callback();
	return false;
}

Library.prototype.removeAllBooks = function(callback) {
	//We replace the entries array, to ensure that the deletion process
	//isn't visible
	var entryBak = this.entries;
	this.entries = new Array();
	//And we save JUST the metadata
	this.save(null);
	
	//Now we purge the real data
	for (var i = 0; i < entryBak.length; i+=1) {
		var entry = entryBak[i];
		//Deleting the book of that entry
		HTMLBook.deleteBook(entry.bookDbName, null);
		//We drop the entry from the disk
		this.libDB.remove("t" + entry.uid);
	}
	//We purge the entries array
	entryBak.length = 0;
	
	//At last, we call the callback, if available
	if (typeof(callback) != "undefined" && callback != null) {
		callback();		
	}
}

