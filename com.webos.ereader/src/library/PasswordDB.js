
/**
 * Creates / loads a PasswordDB with the given Database name. 
 * @param {String} dbname the name of the database that is backing the library. 
 */
function PasswordDB(dbName, key, callback) {
	//console.log("PasswordDB: key = " + key);
	//Sanity check
	if (!dbName || dbName.length <= 0) {
        console.error("PasswordDB must have a DB Name.");
        return;
    }
	if (!callback || callback == null) {
        console.error("PasswordDB must have an onLoad callback.");
        return;
    }
	
	this.dbName = dbName;
	this.callback = callback;
	
	this.isReady = false;
	
	this.key = key;
	
	//The index for the password DB
	this.index = null;
	
	//Loading the database
	this.passDB = new Mojo.Depot(
		{
			name: "ext:" + dbName,
			version: 1,
			replace: false
		},
		this.onOpenSuccess.bind(this),
		this.onFailure.bind(this)
	); 
}

PasswordDB.TYPE_CREDENTIAL = 1;
PasswordDB.TYPE_DEVICEID = 2;

/**
 * Returns a random ASCII check sequence
 */
PasswordDB.getCheckSequence = function(len, seed) {
	if (!len) { return; }
	//Glibc rand()
	var lcg = function(seed) {
		return rnd = (0x41C64E6D * seed + 12345) % 0x100000000;
		return (rnd >= 0) ? rnd : -rnd;
	}
	var str = "";
	if (typeof seed == "undefined") {
		seed = Math.floor(Math.random() * 0x100000000);
	}
	var cnt = 0;
	do {
		seed = lcg(seed);
		str += String.fromCharCode((seed % 94) + 32);
		cnt += 1;
	} while (cnt <= 1024)
	return str;
}

PasswordDB.prototype.onOpenSuccess = function() {
	//console.log("PasswordDB: Open success");
	var success = function(index) {
		if (!index) {
			//Creating a new index
			//console.log("PasswordDB: Creating new index");
			this.sanitizeIndex();
			//Saving the index
			this.passDB.add("index", this.index);
		} else {
			//console.log("PasswordDB: Checking check sequence");
			//Checking if the check sequences match
			var decCheck = Mojo.Model.decrypt(this.key, index.encCheckSeq);
			if (decCheck != index.checkSeq) {
				//Failure! Wrong password
				this.onFailure();
				return;
			}
			this.index = index;
			//And sanitizing / upgrading the index, if necessary
			this.sanitizeIndex();
		}
		//console.log("PasswordDB: Index load success");
		this.isReady = true;
		this.callback(this);
	}
		
	//Fetching the main index
	this.passDB.get(
		"index",
		success.bind(this), this.onFailure.bind(this)
	);
}

PasswordDB.prototype.onFailure = function() {
	//console.log("PasswordDB: Opening DB failed");
	//Reporting the error
	this.callback(null);
}

PasswordDB.prototype.sanitizeIndex = function() {
	if (!this.index) {
		//Creating a new one
		var checkSeq = PasswordDB.getCheckSequence(256);
		this.index = {
			checkSeq: checkSeq,				
			encCheckSeq: Mojo.Model.encrypt(
				this.key, checkSeq
			),
			types: new Array(),
			entries: new Array()
		};
		//Saving the index
		this.passDB.add("index", this.index);
		return;
	}
	//Checking if the check sequences are in place
	if (!this.index.checkSeq || ! this.index.encCheckSeq) {
		this.index.checkSeq = PasswordDB.getCheckSequence(256);
		this.index.encCheckSeq = Mojo.Model.encrypt(
			this.key, this.index.checkSeq
		) 
	}
	//Checking if the arrays are present and in-sync
	if (typeof this.index.types == "undefined" || this.index.types == null ||
			typeof this.index.entries == "undefined" || this.index.entries == null ||
			this.index.types.length != this.index.entries.length) {
		this.index.entries = new Array();
		this.index.types = new Array();
	}
	
	//Saving the index
	this.passDB.add("index", this.index);
}

/**
 * Returns the stored names of all the credentials.
 */
PasswordDB.prototype.getIndex = function(type) {
	//console.log("PasswordDB.getIndex");
	if (typeof type == "undefined" || type == null) {
		return this.index.entries;		
	} else {
		var ret = new Array();
		for (var i = 0; i < this.index.types.length; i+=1) {
			if (this.index.types[i] == type) {
				ret.push(this.index.entries[i]);
			}
		}
		return ret;
	}
}

PasswordDB.prototype.get = function(storeName, callback) {
	//console.log("PasswordDB.get: " + storeName);
	var decrypt = function(callback, entry) {
		if (!entry) {
			//console.log("Couldn't get entry");
			callback(null);
		} else {
			//console.log("Fetched entry, decrypting.");
			//Decrypting the entry
			var dEntry = PasswordEntry.decrypt(entry, this.key);
			//Returning the decrypted entry (is null on error)
			//console.log("Decrypted, calling back");
			callback(dEntry);
		}
	}
	this.passDB.get(
		this.itemize(storeName),
		decrypt.bind(this, callback),
		callback.bind(this,null)
	);
}

PasswordDB.prototype.add = function(type, storeName, username, password, callback) {
	//console.log("PasswordDB.add: " + storeName + ", " + username + ", " + password);
	//Sanity check
	if (!storeName) {
		callback(false);
		return;
	}
	var success = function(type, storeName, callback) {
		if (!storeName) {
			callback(false);
		} else {
			//Adding to the index
			var pos = this.index.entries.indexOf(storeName); 
			if (pos < 0) {
				this.index.entries.push(storeName);
				this.index.types.push(type);
			} else {
				this.index.entries[pos] = storeName;
				this.index.types[pos] = type;
			}
			//Saving the index
			this.passDB.add(
				"index", this.index,
				callback.bind(this, true),
				callback.bind(this, false)
			);
		}
	}
	//Saving the credentials; will also amend the index
	this.passDB.add(
		this.itemize(storeName),
		new PasswordEntry(type, username, password, this.key),
		success.bind(this, type, storeName, callback),
		callback.bind(this, false)
	);
}

PasswordDB.prototype.remove = function(storeName, callback) {
	//console.log("PasswordDB.remove: " + storeName);
	//Removing it from the index
	var pos = this.index.entries.indexOf(storeName);
	if (pos < 0) {
		//console.log("No such entry");
		callback(false);
	} else {
		//console.log("Removing...");
		this.index.entries.splice(pos, 1);
		this.index.types.splice(pos, 1);
		this.passDB.add("index", this.index, null, null);
		this.passDB.remove(null, this.itemize(storeName), callback, callback);	
	}
}

PasswordDB.prototype.removeAll = function(callback) {
	//console.log("PasswordDB.removeAll");
	this.libDB.removeAll(callback, callback);
}

PasswordDB.prototype.itemize = function(str) {
	return "item" + escape(str);
}

PasswordDB.prototype.deitemize = function(itemStr) {
	if (itemStr != null && itemStr.startsWith("item")) {
		return unescape(itemStr.substr(4));
	} else {
		return itemStr;
	}
}

PasswordDB.prototype.changeKey = function(newKey, callback) {
	//console.log("changeKey");
	//This is called after every entry was changed 
	var finisher = function(newKey, callback) {
		//console.log("finisher");
		this.key = newKey;
		callback();
	}.bind(this, newKey, callback)
	
	//Creating the synchronizer
	var synchronizer = new Mojo.Function.Synchronize({
		syncCallback: finisher
	});
	
	//The worker thread that re-encrypts the entries
	var worker = function(storeName, newKey, callback, decEntry) {
		if (!decEntry) { return; }
		//Recrypting
		var nEntry = new PasswordEntry(
			decEntry.type, decEntry.username, decEntry.password, newKey
		);
		//Storing the new entry
		//console.log("Storing: " + storeName);
		this.passDB.add(
			this.itemize(storeName), nEntry,
			callback, callback
		);
	};
	
	var doNothing = function() {};
	//Fetching & re-encrypting all PasswordEntries
	for (var i = 0; i < this.index.entries.length; i+=1) {
		var name = this.index.entries[i];
		this.get(name, worker.bind(
				this, name, newKey, synchronizer.wrap(doNothing)
		));
	}
	//We also need to change the encryption check sequence
	this.index.encCheckSeq = Mojo.Model.encrypt(
			newKey, this.index.checkSeq
	)
	//Saving the index
	var call = synchronizer.wrap(doNothing);
	this.passDB.add(
		"index", this.index,
		call, call
	);
}


// ~~~ STATIC UTILITY FUNCTIONS ~~~

PasswordDB.displayPasswordDialog = function(controller, callbacks) {
	//console.log("displayPasswordDialog");
	var assistant = new PasswordDialogAssistant(
		controller,
		PasswordDB.openDB.bind(this, controller, callbacks),
		callbacks.cancel
	);
		
	//And creating the dialog
	controller.showDialog({
		template: 'Password/Password-dialog',
		assistant: assistant,
		preventCancel: true
    });
}

PasswordDB.getKey = function(controller, callbacks) {
	//console.log("getKey");
	if (globalOptions.masterKeyringMode == 1) {
		//Ask only once
		if (!globalOptions.masterKeyringKey) {
			PasswordDB.displayPasswordDialog(controller, callbacks);
		} else {
			//Opening the password DB
			PasswordDB.openDB(
				controller, callbacks, globalOptions.masterKeyringKey
			);
			return;
		}
	} else if (globalOptions.masterKeyringMode == 2) {
		//Always ask
		PasswordDB.displayPasswordDialog(controller, callbacks);
	} else {
		//This shouldn't happen, we call the cancel callback
		callbacks.cancel(null);
	}
}

PasswordDB.openDB = function(controller, callbacks, password) {
	//console.log("openDB");
	var passDB = new PasswordDB(
		"Keyring", password,
		PasswordDB.checkPasswordDB.bind(
			this, controller, callbacks
		)
	);
}

PasswordDB.checkPasswordDB = function(controller, callbacks, passDB) {
	//console.log("checkPasswordDB");
	if (!passDB) {
		//console.log("Password DB could not be loaded, try again");
		PasswordDB.invalidKeyMsg(controller, callbacks);
	} else {
		//console.log("Pass DB loaded");
		//Storing the password, if allowed
		if (globalOptions.masterKeyringMode == 1 &&
				!globalOptions.masterKeyringKey) {
			globalOptions.masterKeyringKey = passDB.key
		} else if (globalOptions.masterKeyringMode == 2) {
			//Removing the global key
			globalOptions.masterKeyringKey = null;
		}
		//Calling the okay callback with the retrieved DB
		callbacks.okay(passDB);
	}
}

PasswordDB.invalidKeyMsg = function(controller, callbacks) {
	//console.log("invalidKeyMsg");
	var msgDef = "Invalid master key specified. Please try again.";
	var msg = $L({
		value: msgDef, key: "InvalidMasterKeyMsg"
	});
	if (controller) {
		controller.showAlertDialog( {
			onChoose: function(controller, callbacks, value) {
				//Re-Invoking the password retrieval
				PasswordDB.getKey(controller, callbacks);
			}.bind(this, controller, callbacks),
			title: $L("Invalid Master Key"),
			message: msg,
			choices: [{
				label: $L("Okay"),
				value: "okay",
				type: 'affirmative'
			}, ]
		});
	}
}

/**
 * This is the only static utility function that should be called from
 * the outside. It encapsulates all the necessary actions to open
 * the password database. Do note that it creates several dialogues,
 * so please make sure that no dialogues are open before calling
 * invoke().
 * 
 * @param {Object} controller the scene's scene controller.
 * @param {Function} callbackOkay will be called with the password DB
 * 		as last parameter upon success.
 * @param {Function} callbackCancel will be called on error or cancel.
 */
PasswordDB.invoke = function(controller, callbackOkay, callbackCancel) {
	//console.log("invoke");
	//Retrieving the key and trying to open the key DB with it
	PasswordDB.getKey(
		controller, {okay: callbackOkay, cancel: callbackCancel}
	);
}

PasswordDB.resetDB = function(dbName) {
	//The index will be regenerated upon the first load
	new Mojo.Depot({
			name: "ext:" + dbName,
			version: 1,
			replace: true
		},
		null, null
	);
}

PasswordDB.askAddData = function(controller, passDB, type, username, password, callback) {
	//console.log("PasswordDB.askAddData");
	if (!controller) {
		return;
	}
	var params = {
		controller : controller,
		passDB : passDB,
		type : type,
		username : username,
		password : password,
		callback : callback
	};
	//console.log("Defining Func");
	var addData = function(params, doAdd, storeName) {
		//console.log("PasswordDB.askAddData.addData");
		if (!doAdd || !storeName) {
			//Just calling the callback
			if (params.callback) params.callback(false);
		} else if (params.passDB) {
			//We already have a working password DB
			params.passDB.add(
				params.type, storeName, params.username,
				params.password, params.callback
			);
		} else {
			//No working passDB, we invoke the default one and then call add
			//The timeout is vitally important, to give the previous dialogue
			//a chance to quit
			setTimeout(PasswordDB.invoke.bind(this,
				params.controller,
				function(params, storeName, passDB) {
					//console.log("Invoker returned");
					if (passDB) {
						//console.log("... with a valid passDB");
						passDB.add(
							params.type, storeName, params.username,
							params.password, params.callback
						);						
					} else {
						//console.log("... without a valid passDB");
						params.callback(false);
					}
				}.bind(this, params, storeName),
				callback.bind(this, false)
			), 1000);
		}
	}.bind(this, params);
	
	//Generating a default store name
	var storeName = (type == PasswordDB.TYPE_CREDENTIAL)
		? username : password;
	
	//Spawning the asking dialogue
	controller.showDialog({
		template: 'Misc/PasswordAdd-dialog',
		assistant: new PasswordAddDialogAssistant(
			controller, storeName, addData
		),
		preventCancel: false
	});
}


function PasswordEntry(type, username, password, encKey) {
	this.type = type;
	if (!encKey) {
		this.username = username;
		this.password = password;
		this.code = null;
	} else {
		this.username = null;
		this.password = null;
		//Creating the encrypted data field
		var data = (type == 1)
			? escape(username) + ";" + escape(password)
			: ";" + escape(password);
		//Encrypting
		this.code = Mojo.Model.encrypt(encKey, data);
	}
}

PasswordEntry.decrypt = function(entry, key) {
	var dec = Mojo.Model.decrypt(key, entry.code);
	//console.log("Decrypted entry: " + dec);
	var split = dec.split(";");
	if (split.length < 2) {
		console.log("Error during decryption");
		return null;
	}
	return new PasswordEntry(
		entry.type, unescape(split[0]), unescape(split[1])
	);
}
