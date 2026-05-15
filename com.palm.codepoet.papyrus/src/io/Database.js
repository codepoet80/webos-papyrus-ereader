
/**
 * Creates or opens a new database with the given name.
 * You can optionally specify a version.
 * @param {String} dbname the name of the database
 * @param {Number} version an optional version
 */
function Database(dbname, version, callback) {
	this.init(dbname,version,callback);
}

Database.prototype.init = function(dbname,version,callback) {
	if (!callback) callback = function() {};
	//console.log("Opening db: " + dbname);
	this.dbname = dbname;
	this.version = version;
	this.isReady = false;
	this.callback = callback;
	// Safari requires all 4 args; our IndexedDB shim ignores extras.
	this.db = openDatabase(dbname, version || '1.0', dbname, 5 * 1024 * 1024);
	
	if (this.db) {
		var setAutoVac = function(success) {
			// Avoid a separate sqlite_master lookup here. On webOS WebSQL that
			// extra startup transaction can be delayed behind large import writes.
			this.createTable("data", "name TEXT PRIMARY KEY, value TEXT",
				function(created) {
					this.isReady = created;
					this.callback(this.isReady);
				}.bind(this)
			);
		}.bind(this);
		//Setting the auto-vacuum pragma
		this.setAutoVacuum(1, setAutoVac);
	} else {
		//Couldn't open
		callback(false);
	}
}


/**
 * Sanitizes a name so that it can be stored in the DB.
 * @param {String} input the name that should be sanitized.
 */
Database.makeSaneName = function(input) {
	//We make sure that the dbName is sane
	var sane = input.replace(/[^\w]/g, "_");
	return sane;
}

Database.prototype.setAutoVacuum = function(val, callback) {
	if (!callback) callback = function() {};
	// PRAGMA auto_vacuum is not authorized on webOS, skip it and continue
	// Calling callback with true to continue initialization
	setTimeout(function() { callback(true); }, 0);
}

Database.prototype.tableExists = function(name, callback) {
	if (!callback) callback = function() {};
	//console.log("tableExists");
	var exists = function(callback, SQLResultSet) {
		if (SQLResultSet == null) {
			//console.log("Table does not exist");
			callback(false);
		} else {
			//console.log("Table might exist");
			callback(SQLResultSet.rows.length > 0);	
		}
	}.bind(this, callback);
	//Selecting from the master table
	this.select("sqlite_master", "name", "name", name, exists);
}

Database.prototype.select = function(table, retCol, matchCol, matchVal, callback){
	if (!callback) callback = function() {};
	//console.log("select");
	this.db.transaction(
		function(table, retCol, matchCol, matchVal, callback, tx) {
			if (typeof(matchCol) != "undefined" && matchCol != null) {
				var sql = "SELECT " + retCol + " FROM " + table + " WHERE " + matchCol + " = ?;";
				var arr = [matchVal];
			} else {
				var sql = "SELECT " + retCol + " FROM " + table + ";";
				var arr = [];
			}
			//console.log("Query = " + sql);
            tx.executeSql(sql, arr,
				function(callback, tx, SQLResultSet) { //onSuccess
					if (SQLResultSet == null || SQLResultSet.rows.length <= 0) {
						//console.log("Select returned nothing.");
						callback(null);
					} else {
						//console.log("Select returned something.");
						callback(SQLResultSet);
					}
				}.bind(this, callback),
				function(callback, tx, error) { //onFailure (statement error)
					//console.log("Select failed");
					callback(null);
				}.bind(this, callback)
			)
        }.bind(this, table, retCol, matchCol, matchVal, callback),
		function(error) { // transaction error callback - prevents silent hang
			callback(null);
		}
	);
}

/**
 * Reads a named variable from the DB and returns the associated
 * string value.
 * @param {Object} name the name of the variable that's stored in the DB.
 * @param {Object} callback the function to call once the data is loaded.
 * @return an array containing the string value that is associated with
 * 		the given name, or an empty array if the named variable does not
 * 		exist or null if an error occured.
 */
Database.prototype.read = function(name, callback) {
	if (!callback) callback = function() {};
	//console.log("read");
	//We check if the db object's ready
	if (this.isReady == false) {
		callback(null);
		return;
	}
	var fetchVal = function(callback, sql) {
		if (sql == null || sql.rows == null) {
			callback(null);
			return;
		}
		var ret = new Array();
		for (var i = 0; i < sql.rows.length; i+=1) {
			ret.push(sql.rows.item(i).value);
		}
		callback(ret);
	}.bind(this, callback);
	this.select("data", "value", "name", name, fetchVal);
}

Database.prototype.write = function(name, value, callback) {
	if (!callback) callback = function() {};
	//console.log("write");
	//We check if the db object's ready
	if (this.isReady == false) {
		callback(null);
		return;
	}
	this.db.transaction(
		function(name, value, callback, tx) {
			var sql = "INSERT OR REPLACE INTO data (name,value) values (\'" +
					name + "\', ?);";
			//console.log("Query = " + sql);
            tx.executeSql(sql, [value],
				function(callback, tx, SQLResultSet) { //onSuccess
					//console.log("Write success");
					callback(true);
				}.bind(this, callback),
				function(callback, tx, error) { //onFailure (statement error)
					//console.log("Write failure");
					callback(false);
				}.bind(this, callback)
			)
        }.bind(this, name, value, callback),
		function(error) { // transaction error callback - prevents silent hang
			enyo.warn("Database.write transaction error: " + (error ? error.message : "unknown"));
			callback(false);
		}
	);
}

/**
 * Writes multiple name/value pairs in a single database transaction.
 * Much faster than N individual write() calls because it incurs only one
 * transaction open/commit/disk-flush instead of N.
 * @param {Array} pairs  Array of {name, value} objects to insert.
 * @param {Function} callback  Called with true on success, false on failure.
 */
Database.prototype.writeBatch = function(pairs, callback) {
	if (!callback) callback = function() {};
	if (!pairs || pairs.length === 0) { callback(true); return; }
	if (this.isReady === false) { callback(false); return; }

	this.db.transaction(
		function(pairs, callback, tx) {
			for (var i = 0; i < pairs.length; i++) {
				var sql = "INSERT OR REPLACE INTO data (name,value) values ('" +
					pairs[i].name + "', ?);";
				tx.executeSql(sql, [pairs[i].value],
					null,  // individual statement success - handled at transaction level
					function(callback, tx, error) {  // statement error - abort transaction
						enyo.warn("writeBatch statement error: " + error.message);
						return true;  // returning true aborts the transaction
					}.bind(this, callback)
				);
			}
		}.bind(this, pairs, callback),
		function(error) {  // transaction error
			enyo.warn("Database.writeBatch transaction error: " + (error ? error.message : "unknown"));
			callback(false);
		},
		function() {  // transaction success
			callback(true);
		}
	);
};

Database.prototype.remove = function(name, callback) {
	if (!callback) callback = function() {};
	//console.log("remove: " + name);
	var sql = "DELETE FROM data WHERE name == " + name + ";";
	this.executeBooleanSQL(sql, callback);
}


Database.prototype.createTable = function(name, scheme, callback) {
	if (!callback) callback = function() {};
	//console.log("createTable: " + name);
	var sql = "CREATE TABLE IF NOT EXISTS " + name + " (" + scheme + ");";
	this.executeBooleanSQL(sql, callback);
}

Database.prototype.flushTable = function(name, callback) {
	if (!callback) callback = function() {};
	//console.log("flushTable: " + name);
	var sql = "DELETE FROM TABLE " + name + ";";
	this.executeBooleanSQL(sql, callback);
}

Database.prototype.dropTable = function(name, callback) {
	if (!callback) callback = function() {};
	//console.log("dropTable: " + name);
	var sql = "DROP TABLE " + name + ";";
	this.executeBooleanSQL(sql, callback);
}

Database.prototype.vacuum = function(callback) {
	if (!callback) callback = function() {};
	//console.log("vacuum");
	var sql = "VACUUM;";
	this.executeBooleanSQL(sql, callback);
}

Database.prototype.purgeDB = function(callback) {
	if (!callback) callback = function() {};
	//console.log("purgeDB");
	//The function that deletes the dbs
	var deleter = function(callback, result) {
		//console.log("deleter");
		if (result == null || result.rows == null) {
			callback(false);	
		};
		var vacWait = function(callback, curr, max, res) {
			//console.log("vacWait; success = " + res);			
			if (curr < max) return;
			//We have dropped the last table!
			this.vacuum(callback);
		};
		var len = result.rows.length;
		for (var i = 0; i < len; i+=1) {
			var name = result.rows.item(i).name;
			this.dropTable(name, vacWait.bind(this, callback, i, len-1))
		}
	}.bind(this,callback);
	//We get a list of all tables and drop them
	var sql = this.select("sqlite_master", "name", null, null, deleter);
}

Database.prototype.executeBooleanSQL = function(sql, callback) {
	//console.log("executeBooleanSQL");
	this.db.transaction(
		function(sql, callback, tx) {
			//console.log("Query = " + sql);
            tx.executeSql(sql, [],
				function(callback, tx, SQLResultSet) { //onSuccess
					callback(true);
				}.bind(this, callback),
				function(callback, tx, error) { //onFailure (statement error)
					enyo.warn("SQL Error: Code " + error.code);
					enyo.warn("SQL Error: Message: " + error.message);
					callback(false);
				}.bind(this, callback)
			);
			//console.log("Query sent");
        }.bind(this, sql, callback),
		function(error) { // transaction error callback - prevents silent hang
			enyo.warn("executeBooleanSQL transaction error: " + (error ? error.message : "unknown"));
			callback(false);
		}
	);
}

/**
 * If pReader is running while the usb drive connection is made, the
 * result is that the application is disconnected from the sqllite
 * database.  Apparently read operations still continue to work, but
 * all writes seem fail silently.
 * The intention of this rountine is to attempt to write and read
 * back a unique timestamp value and thereby prove the database
 * connection is live.
 * This should be called as needed before beginning any transactions
 * that write data to sqllite. (at least until WebOS corrects this
 * problem)
 */
Database.prototype.verifyConnection = function(callback) {
	if (!callback) callback = function() {};
	//console.log("Database.verifyConnection");
	//We check if the db object's ready
	if (this.isReady == false) {
		callback();
		return;
	}

	var timeStamp = (new Date()).valueOf();

	var verifyCompareValue = function(val) {
		// read() returns an array of row values, so unwrap before comparing.
		var readVal = (val && val.length > 0) ? val[0] : null;
		if (readVal == timeStamp) { //db connection is live
			callback();
		}
		else { // db connection is dead, re-initialize
			//console.log("Database.verifyConnection->re-initialize db!");
			this.init(this.dbname,this.version,callback);
		}
	}.bind(this);

	var verifyRead = function() {
		this.read("verifyConnection", verifyCompareValue);
	}.bind(this);

	var verifyWrite = function() {
		this.write("verifyConnection", timeStamp, verifyRead);
	}.bind(this);

	verifyWrite();
}

