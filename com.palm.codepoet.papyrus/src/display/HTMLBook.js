
/** The size of each chunk in plain-text bytes. */
HTMLBook.chunkSize = 16384;

/**
 * Creates an HTML book from a reader, or simply loads it from an internal DB.
 * @param {Object} reader the ByteReader from which to construct the book.
 * 		If reader is null, a loading from an internal DB is attempted.
 * @param {Boolean} readerIsPlainText if set to true, the data from the reader is
 * 		treated as plain-text. Setting this speeds up reading.
 * @param {String} baseName the base-name of the entry in the DB.
 * @param {Function} callback the function to call after everything is loaded.
 * 		It is called with this object as a parameter.
 */
function HTMLBook(reader, readerIsPlainText, dbName, callback, progressCallback) {
	//console.log("Constructor");
	this.reader = reader;
	this.readerIsPlainText = readerIsPlainText;
	this.dbName = "ext:t" + Database.makeSaneName(dbName);
	this.callback = callback;
	// Optional: called each time a chunk or image is processed, so the caller
	// can reset a watchdog timer.  null = disabled.
	this.progressCallback = progressCallback || null;

	//Storing the current reader position for load progress
	this.currLoadPos = 0;

	//A simple array used to remember which images were already stored
	this.imgNameBuffer = [];
	
	//Setting defaults
	this.loadDefaults();
	
	//Opening the database for this book
	this.bookDB = new Database(
		this.dbName, "1",
		this.loadDB.bind(this)
	);
}


HTMLBook.prototype.loadDefaults = function() {
	this.length = 0;
	this.numBuffers = 0;
	this.bufferOffsets = new Array();
	this.bufferOffsets[0] = 0;
	
	//This array holds the last few loaded buffers and their numbers
	//[0] = buffer; [1] = number; [2] = buffer; ...
	this.currBuffers = new Array();
	this.maxBuffers = 2;
	
	//The buffer for the image data
	this.lastImageData = null;
	this.lastImageLabel = null;
	this.storedImageCount = 0;
	this.lastImportProgressPct = -1;
	this.lastImportProgressTime = 0;
	
	//The file's fixed bookmarks, used for links
	//See: LibraryEntry.js; Bookmark object
	this.bookmarks = new Array();

	//Checking if the reader is capable of reading imgs
	if (this.reader != null && this.reader.getImage) {
		this.isImgCapable = true;
	} else {
		this.isImgCapable = false;
	}
	
	//Flagging ourselves as not yet ready
	this.isReady = false;
}

// ~~~ Database Loading methods ~~~ 

HTMLBook.prototype.loadDB = function(isReady) {
	enyo.log("HTMLBook.loadDB: ready=" + isReady + ", importing=" + (this.reader != null));
	if (isReady == false) {
		this.dbOpenFail();
		return;
	}
	//Otherwise, we check if we must read new data
	if (this.reader == null) {
		//Just loading from the DB
		this.bookDB.read("meta", this.dbOpenLoad.bind(this));
	} else {
		enyo.log("HTMLBook.loadDB: starting fresh import");
		// Imports always use a generated database name, so there is no existing
		// metadata to preserve. Start reading immediately and avoid another WebSQL
		// read before visible progress can begin.
		this.readFromReader(0, null);
	}
}

HTMLBook.prototype.dbOpenReplace = function(data) {
	enyo.log("HTMLBook.dbOpenReplace: meta " + (data == null ? "not found" : "found"));
	
	//Checking if metadata was present
	if (data == null) {
		//We only need to read the new data 
		this.readFromReader(0, null);
	} else {
		//We purge the database, and then read
		this.bookDB.purgeDB(
			this.readFromReader.bind(this, 0, null)
		);
	}
}

HTMLBook.prototype.dbOpenLoad = function(data) {
	enyo.log("HTMLBook.dbOpenLoad: loading metadata from database");
	var fail = function(msg) {
		//There is no metadata
		enyo.warn("HTMLBook.dbOpenLoad FAILED: " + msg);
		this.isReady = false;
		this.callback(this);
	}.bind(this);
	//Checking if we've got data
	if (data == null) {
		fail("Attempted to load an HTMLBookDB, but there was no Metadata entry.");
		return;
	}
	//Otherwise, we've just fetched a metadata string that we need to decode
	var meta = this.decodeMetaData(data[0]);
	//Sanity checking the metadata
	if (meta == null) {
		fail("Metadata entry of an HTMLBook was invalid.");
		return;
	}
	//Copying the metadata to this object
	this.length = meta.length;
	this.numBuffers = meta.numBuffers;
	this.bufferOffsets = meta.bufferOffsets;
	this.bookmarks = meta.bookmarks;

	enyo.log("HTMLBook.dbOpenLoad: SUCCESS - length=" + this.length + ", numBuffers=" + this.numBuffers + ", bufferOffsets.length=" + this.bufferOffsets.length + ", bookmarks=" + this.bookmarks.length);

	//Flagging ourselves as ready
	this.isReady = true;
	//Calling the callback
	this.callback(this);

}

HTMLBook.prototype.dbOpenFail = function() {
	var msg = "Could not open HTML Book database."; 
    enyo.warn(msg); 
    Mojo.Controller.errorDialog(msg);
	//Setting the flags
	this.isReady = false;
	//And calling the callback
	this.callback(this);
};

// ~~~ Data loading methods ~~~

/**
 * Reads another chunk from the reader and stores it in the db. Will
 * call this.callback() once all chunks are loaded and stored.
 * @param {Object} currPos the current position in the ByteReader stream
 * @param {Object} openTags the HTML tags that open from the last chunk
 */
HTMLBook.prototype.readFromReader = function(currPos, openTags, isRecursiveCall) {
	//console.log("readFromReader");

	// Signal progress on every chunk so the watchdog resets and the spinner
	// shows a percentage.  The DOM update is throttled in keepAlive so the
	// browser can repaint between updates.
	if (this.progressCallback) {
		try {
			var totalLen = (this.reader && this.reader.getLength) ? this.reader.getLength() : 0;
			var pct = (totalLen > 0) ? Math.min(99, Math.round(currPos * 100 / totalLen)) : 0;
			var now = (new Date()).getTime();
			if (this.lastImportProgressPct < 0 || pct >= this.lastImportProgressPct + 5 || pct >= 99 || now - this.lastImportProgressTime >= 5000) {
				this.lastImportProgressPct = pct;
				this.lastImportProgressTime = now;
				var progressMsg = "Processing text " + pct + "%";
				enyo.log("HTMLBook progress: " + progressMsg);
				this.progressCallback(progressMsg);
			}
		} catch (e) {
			enyo.warn("HTMLBook progress callback failed: " + e);
		}
	}

	if (!isRecursiveCall) {
		//Resetting the img buffer
		this.imgNameBuffer.length = 0;
		this.storedImageCount = 0;
		this.lastImportProgressPct = -1;
		this.lastImportProgressTime = 0;
	}

	//Saving the current loading position
	this.currLoadPos = currPos;
	
	//What to do after the last chunk has been read and all buffers flushed
	var finish = function(){
		//console.log("Calling finish.");
		//We have finished loading from the reader. Invalidating it
		this.reader = null;
		//We signify that we're ready
		this.isReady = true;

		//We save our own metadata
		this.saveMetaData();

		//console.log("The book has a length of: " + this.getLength());

		//And we call our callback
		this.callback(this);
	}.bind(this);

	//console.log("Reading chunk for pos " + currPos);
	//Trying to read another chunk
	var byteBuf = this.reader.read(currPos, HTMLBook.chunkSize);
	if (byteBuf == null || byteBuf.length <= 0) {
		finish();
		return;
	}

	//console.log("Read " + byteBuf.length + " bytes");

	//Constructing an HTMLBuffer from that chunk
	var buffer = new HTMLBuffer(openTags);
	var dropped = buffer.addBytes(byteBuf, this.readerIsPlainText);

	//Checking if the document ends malformed on an open tag
	if (byteBuf.length - dropped <= 0) {
		//There is nothing to do anymore, since the end's malformed
		finish();
		return;
	} else {
		//Moving forward in the stream, but fetching the dropped chars again
		currPos += byteBuf.length - dropped;		
	}
	
	//The function that processes the tags of the buffer
	//It relinquishes control to WebOS after every img tag
	var tagWorker = function(buffer, pos, self, callback) {
		//Checking if we've finished modifying the tags
		if (pos >= buffer.tags.length) {
			//Calling the callback
			callback();
			return;
		}
		var breakForWebOS = false;
		while (pos < buffer.tags.length && !breakForWebOS) {
			//console.log("Parsing tag: " + pos);
			var tag = buffer.tags[pos];
			//Sanity checking the tag and ignoring closers
			if (tag == null || tag.closing) {
				pos += 1;
				continue;
			}
			//Now, tags may carry an ID, recording that as a bookmark
			var attr = tag.getAttribute("id");
			if (attr != null && attr.value != null) {
				this.bookmarks.push(
					new Bookmark(attr.value, this.length + tag.position)
				);	
			}
			
			switch(tag.name) {
				case "a":
					//Checking if we deal with an anchor
					var attr = tag.getAttribute("name");
					if (attr != null && attr.value != null && attr.value.length > 0) {
						//console.log("Pushing bookmark: " + attr.value);
						//Creating a bookmark with the label and the tag's position
						this.bookmarks.push(new Bookmark(attr.value, this.length + tag.position));
					}
					//Checking if we deal with a link TO an anchor inside the doc
					attr = tag.getAttribute("href");
					if (attr != null && attr.value != null &&
							attr.value.length > 0 && attr.value.startsWith("#")) {
						//We deal with an intra-document link, we must generate
						//a custom event when it's clicked / tapped
						var cmd = "Mojo.Event.send(document, &quot;ReaderHandleLinkClick&quot, " + 
							"{ label: &quot;" + attr.value.slice(1) + "&quot; });";
						tag.content = "onclick=\""+ cmd + "\"";
					}
					break;
					
				case "img":
					enyo.log("HTMLBook: Found img " + tag.toString());
					//IMG tag cause us to break back to WebOS
					breakForWebOS = true;
					//Checking if we can read imgs at all
					if (this.isImgCapable == false) { break; }
					//Checking if the img tag has a label
					var label = tag.getAttribute("label");
					if (label == null) { break; }
					label = label.value;
					
					//We check if we've already added such a label
					if (this.imgNameBuffer.indexOf(label) >= 0) {
						//We already added that img
						breakForWebOS = false;
						break;
					}
					
					//Now, we try to fetch the img data from the buffer
					var bytes = this.reader.getImage(label);
					if (bytes == null || bytes.length <= 0) {
						enyo.warn("Image data invalid/empty.");
						break;
					}
					//Storing the bytes in the DB and in the array
					var name = "img" + Database.makeSaneName(label);
					this.storedImageCount += 1;
					if (this.progressCallback) {
						var imageSize = (typeof(bytes) == "string") ? bytes.length : bytes.length;
						var imageKb = Math.max(1, Math.round(imageSize / 1024));
						this.progressCallback("Encoding image " + this.storedImageCount);
					}
					//Now we check whether getImage returned a base64 string or raw bytes
					if (typeof(bytes) == "string") {
						enyo.log("HTMLBook: Image data already Base64");
						this.imgNameBuffer.push(label);
						this.bookDB.write(name, bytes);
					} else {
						enyo.log("HTMLBook: Image data must be Base64-ed");
						this.imgNameBuffer.push(label);
						this.bookDB.write(name, bytesToBase64(bytes));
					}
					// Signal again after conversion/write so the watchdog knows the
					// expensive synchronous part completed.
					if (this.progressCallback) {
						this.progressCallback("Storing image " + this.storedImageCount + "...");
					}
					break;
			}
			//Checking if we need to break for WebOS
			if (breakForWebOS) {
				break;
			} else {
				pos += 1;
			}
		}
		
		//At the end, we call ourselves deferred for the next tag
		self.bind(this, buffer, pos+1, self, callback).defer();
	}
	
	var storeWorker = function(buffer, currPos, openTags) {
		openTags = buffer.getOpenTagsEnd();

		this.bufferOffsets[this.numBuffers] = this.length;
		this.length += buffer.getLength();
		this.numBuffers += 1;

		this.saveBufferData(this.numBuffers - 1, buffer,
			this.readFromReader.bind(this, currPos, openTags, true)
		);
	}
	
	//We call the tagWorker, which calls the storeWorker, which calls
	//this function again. Isn't Javascript fun?
	tagWorker.bind(this, buffer, 0, tagWorker,
		storeWorker.bind(this, buffer, currPos, openTags)
	).defer();
}

HTMLBook.prototype.getLength = function() {
	return this.length;
}

HTMLBook.prototype.getLoadProgress = function() {
	if (this.reader == null) {
		//There is nothing to load anymore
		//console.log("Nothing to load");
		return 1.0;
	}
	//Fetching the length of the reader
	var readLen = this.reader.getLength();
	//Checking if that length is sane
	if (readLen < 0 || readLen < this.currLoadPos) {
		//console.log("Read Len invalid: " + this.currLoadPos + " / " + readLen);
		return 1.0;
	} else {
		//console.log("Progress = " + this.currLoadPos + " / " + readLen);
		return this.currLoadPos / readLen;
	}
}

// ~~~ Rich Text Fetching methods ~~~

HTMLBook.prototype.read = function(start, length, callback) {
	enyo.log("HTMLBook.read: start=" + start + ", length=" + length + ", totalLength=" + this.getLength() + ", numBuffers=" + this.numBuffers + ", bufferOffsets.length=" + this.bufferOffsets.length);
	//Sanity check
	if (typeof(callback) == "undefined") {
		enyo.error("HTMLBook.read() absolutely needs a callback.")
		return null;
	}
	if (start < 0 || length < 0 || start > this.getLength()) {
		enyo.log("HTMLBook.read: invalid params (start=" + start + ", length=" + length + ", bookLen=" + this.getLength() + "), calling callback with empty array");
		callback([]);
		return null;
	}
	//Sanitizing the length
	length = Math.min(length, this.getLength() - start);

	//At first, we determine which buffers we must get
	var startChunk = this.getBufferContainment(start);
	var endChunk = this.getBufferContainment(start + length);

	enyo.log("HTMLBook.read: startChunk=" + startChunk + ", endChunk=" + endChunk);

	//Checking if we can fetch anything at all
	if (startChunk < 0 || startChunk >= this.bufferOffsets.length ||
			endChunk < 0 || endChunk >= this.bufferOffsets.length) {
		//This shouldn't happen - but we MUST call callback to avoid hanging
		enyo.error("HTMLBook.read: Invalid chunks! startChunk=" + startChunk + ", endChunk=" + endChunk + ", bufferOffsets.length=" + this.bufferOffsets.length);
		callback([]);
		return null;
	}
	
	//Now that we have the numbers of the chunks that we must get,
	//we start a synchronized fetch
	var numBufs = (endChunk - startChunk) + 1;
	var buffers = new Array();
	
	//We grab the buffers and then call the assembler
	this.grabBuffers(buffers, startChunk, numBufs,
		this.assembleRichText.bind(
			this, start, length, buffers, this.bufferOffsets[startChunk], callback
		)
	);
}

/**
 * Returns the HTMLBuffer the given byte position is in.
 * @param {Object} value the byte position to search for.
 */
HTMLBook.prototype.getBufferContainment = function(value) {
	if (this.bufferOffsets.length == 0) return -1;
	var left = 0;
	var right = this.bufferOffsets.length - 1;
	var middle, val;
	//At first, we search the start chunk
	do {
		middle = Math.floor((left + right) / 2);
		offset = this.bufferOffsets[middle];
		//Checking if the middle contains or is left/right of the start
		if (value >= offset) {
			left = middle;
		} else {
			right = middle;
		}
	} while (right - left > 1);
	//Checking whether left or right contains the searched value
	if (this.bufferOffsets[left] <= value &&
			this.bufferOffsets[right] > value) {
		middle = left;
	} else {
		middle = right;
	}
	//Now, if many elements had an identical offset (no plain bytes)
	//We must find the FIRST of the entries
	while (middle > 0 && this.bufferOffsets[middle-1] >= value) {
		middle -= 1;
	}
	//We found the earliest possible buffer
	return middle;
}

HTMLBook.prototype.grabBuffers = function(buffers, bufNum, remaining, callback, buffer) {
	//console.log("grabBuffers " + bufNum + " - " + remaining);
	//Sanity check
	if (bufNum < 0 || remaining <= 0) {
		callback();
		return;
	}
	//Checking if we must fetch or can add
	if (buffer == null) {
		this.loadBufferData(bufNum,
			this.grabBuffers.bind(this, buffers, bufNum, remaining, callback)
		);
	} else {
		//We add the buffer
		buffers.push(buffer);
		//We set the new variables
		bufNum += 1;
		remaining -= 1;
		//We check if there's more to do
		if (remaining > 0) {
			//We fetch the next buffer
			this.loadBufferData(bufNum,
				this.grabBuffers.bind(this, buffers, bufNum, remaining, callback)
			);
		} else {
			//We have all the buffers we need
			callback();
		}
	}
}

/**
 * Assembles the rich text stored in several HTMLBuffers into a single
 * rich text object.
 * @param {Object} start the position of the first byte in the stream (total,
 * 		not from beginning of the first "buffers" buffer)
 * @param {Object} length the plain-text length that is desired
 * @param {Object} buffers an array of HTMLBuffers that serve as data sources
 * @param {Object} offset the position of the first buffer in the stream
 * @param {Object} callback the function to call with a result.
 */
HTMLBook.prototype.assembleRichText = function(start, length, buffers, offset, callback){
	//console.log("Called assembleRichText");
	
	//console.log("start = " + start);
	//console.log("length = " + length);
	
	//Now that we have all the necessary buffers, we load the rich text
	var byteBuf = new Array();
	var currPos = start - offset;
	for (var i = 0; i < buffers.length; i+=1) {
		//Checking if we've fetched enough
		if (length <= 0) break;
		
		var buffer = buffers[i];
		//Fetching the rich text from the buffer
		var richText = buffer.getRichText(currPos, length);
		//Checking if we need to append the start tags
		if (i == 0) {
			concatArray(byteBuf,richText.startTags);
		}
		//Appending the body
		concatArray(byteBuf,richText.body);
		//And checking if the end tags need to added
		if (i == buffers.length - 1) {
			concatArray(byteBuf,richText.endTags);
		}
		//Modifying start and length
		currPos = 0; //Because we start from the first byte of the next buffer
		//length -= richText.body.length;
		length -= richText.bodyPlainBytesNum;
	}
	//Now, we call the callback with the finished byteBuf
	enyo.log("HTMLBook.assembleRichText: result byteBuf length=" + byteBuf.length + ", numBuffers=" + buffers.length);
	callback(byteBuf);
}

/**
 * Returns whether or not this byteReader's read() function
 * is asynchronous or synchronous. In other words, if this
 * function returns true, the read() function returns immediately
 * and will actually call the callback function when the data
 * arrives. 
 */
HTMLBook.prototype.readIsAsync = function() {
    return true;
}

HTMLBook.prototype.getPosForBookmarkLabel = function(label) {
	//console.log("getPosForBookmarkLabel: " + label);
	for (var i = 0; i < this.bookmarks.length; i+=1) {
		var bm = this.bookmarks[i];
		enyo.log("Comparing with: " + bm.label);
		if (bm.label == label) {
			return bm.position;
		}
	}
	return null;
}


// ~~~ Database Storage methods ~~~

/**
 * Saves the metadata block -- in other words THIS object
 */
HTMLBook.prototype.saveMetaData = function() {
	//console.log("Saving Meta Data");
	
	var meta = "";
	meta += this.length + ";";
	meta += this.numBuffers + ";";
	//Saving the bufferOffsets array
	meta += this.bufferOffsets.length + ";"
	for (var i = 0; i < this.bufferOffsets.length; i+=1) {
		meta += this.bufferOffsets[i] + ";";
	}
	//Saving the bookmarks array; bookmarks have two fields
	meta += (this.bookmarks.length * 2) + ";"
	for (var i = 0; i < this.bookmarks.length; i+=1) {
		meta += escape(this.bookmarks[i].label) + ";";
		meta += this.bookmarks[i].position + ";";
	}
	//We don't care whether it's successful or not
	this.bookDB.write("meta", meta, function(){});
}

HTMLBook.prototype.decodeMetaData = function(data) {
	//console.log("decodeMetaData");
	//At first, we split along ";"
	var fields = data.split(";");
	var meta = new Object();
	var i = 0;
	//The first field contains the length
	meta.length = parseInt(fields[i++]);
	
	//The second is the numBuffers
	meta.numBuffers = parseInt(fields[i++]);
	
	//Decoding the offsets array
	if (i >= fields.length) { return meta; }
	var end = i + parseInt(fields[i]); i++;
	meta.bufferOffsets = new Array();
	if (end < fields.length) {
		for (; i <= end; i += 1) {
			meta.bufferOffsets.push(parseInt(fields[i]));
		}
	}
	
	//Decoding the bookmark array
	if (i >= fields.length) { return meta; }
	var end = i + parseInt(fields[i]); i++;
	meta.bookmarks = new Array();
	if (end < fields.length) {
		for (; i <= end; i+= 2) {
			var label = unescape(fields[i]);
			var pos = parseInt(fields[i+1]);
			meta.bookmarks.push(new Bookmark(label, pos));
		}		
	}
	
	return meta;
}

/**
 * Saves the given buffer under the given number.
 * @param {Object} bufferNum the number in the database that will be assigned.
 * @param {Object} buffer the HTMLBuffer that should be stored.
 */
HTMLBook.prototype.saveBufferData = function(bufferNum, buffer, callback) {
	//console.log("Saving Buffer Data for " + bufferNum);
	var name = "t" + bufferNum;
	var save = buffer.getSaveState();
	if (typeof(callback) != "undefined" && callback != null) {
		this.bookDB.write(name, save, callback);
	} else {
		this.bookDB.write(name, save);
	}
}

/**
 * Loads the buffer with the given number and calls the callback function
 * with the loaded buffer as its argument. Will pass null if no such buffer
 * is present.
 * @param {Object} bufferNum the number of the buffer in the DB.
 * @param {Object} callback the function to call once the buffer is loaded.
 */
HTMLBook.prototype.loadBufferData = function(bufferNum, callback) {
	enyo.log("HTMLBook.loadBufferData: bufferNum=" + bufferNum + ", numBuffers=" + this.numBuffers);
	//Sanity check
	if (bufferNum < 0 || bufferNum >= this.numBuffers) {
		enyo.error("HTMLBook.loadBufferData: Invalid bufferNum=" + bufferNum + " (numBuffers=" + this.numBuffers + ")");
		callback(null);
		return;  // Bug fix: was missing return!
	}
	
	//Checking if we've buffered that number
	for (var i = 0; i < this.currBuffers.length; i+=2) {
		var buf = this.currBuffers[i];
		var num = this.currBuffers[i+1];
		if (num == bufferNum) {
			callback(buf);
			return;
		}		
	}
	
	var name = "t" + bufferNum;
	this.bookDB.read(
		name,
		function(num, data) {
			//Checking if there was such a buffer
			if (data && data != null) {
				enyo.log("HTMLBook.loadBufferData: loaded buffer " + num + ", data length=" + (data[0] ? data[0].length : 0));
				//Creating a new buffer and copying the values
				var buf = new HTMLBuffer(null);
				buf.loadFromSaveState(data[0]);
				//Buffering the result; dropping front if full
				if (this.currBuffers.length >= 2*this.maxBuffers) {
					this.currBuffers.shift();
					this.currBuffers.shift();
				}
				this.currBuffers.push(buf);
				this.currBuffers.push(num);
				//And invoking the callback with the new buffer
				callback(buf);
			} else {
				//Failure to load
				enyo.error("HTMLBook.loadBufferData: FAILED to load buffer " + num + " from database!");
				callback(null);
			}
		}.bind(this, bufferNum)
	);
}

HTMLBook.prototype.getImages = function(labels, callback, result) {
	//console.log("HTMLBook: getImages");
	if (typeof(result) == "undefined" || result == null) {
		result = new Array();
	}
	if (labels.length == result.length) {
		//console.log("HTMLBook: getImages -> Fetched enough");
		//We've fetched enough images, calling back
		callback(result);
		return;
	}
	var pusher = function(labels, callback, result, data) {
		//console.log("HTMLBook: getImages: pusher");
		result.push(data);
		this.getImages(labels, callback, result);
	}.bind(this, labels, callback, result);
	//Otherwise, we fetch an image and call the pusher
	var pos = result.length;
	this.getImage(labels[pos], pusher);
	return;
	
}

HTMLBook.prototype.getImage = function(label, callback) {
	enyo.log("HTMLBook: getImage " + label);
	//Checking the buffer
	if (this.lastImageLabel == label) {
		//console.log("Returned a buffered img!")
		callback(this.lastImageData);
		return;
	}
	var name = "img" + Database.makeSaneName(label);
	this.bookDB.read(
		name,
		function(label, data) {
			//Checking if there was such a buffer
			if (data && data != null && data.length > 0) {
				enyo.log("getImage okay.");
				//Saving this data as our last buffered image
				this.lastImageData = data[0];
				this.lastImageLabel = label;
				callback(data[0]);
			} else {
				//Failure to load
				enyo.log("No such image");
				callback(null);
			}
		}.bind(this, label)
	);
}

/**
 * Deletes the book in its entirety from the internal database.
 * This automatically invalidates this object. The object MUST
 * be refreshed with a "readFromReader", otherwise it will
 * be unusable.
 * @param {Object} callback the function that is called after everything is deleted
 */
HTMLBook.prototype.deleteSelfFromDB = function(callback) {
	//console.log("deleteSelfFromDB");
	//We overwrite the in-memory data
	this.loadDefaults();
	//And purge the DB on the storage
	this.bookDB.purgeDB(callback);
}

HTMLBook.deleteBook = function (baseName, callback) {
	if (typeof(callback) == "undefined" || callback == null) {
		callback = function() {};
	}
	//The delete function
	var delFunct = function(callback, book) {
		//We tell the book to delete itself and call the callback afterward
		book.deleteSelfFromDB(callback);
	}
	//Loading the book in question
	var book = new HTMLBook(
		null, false, baseName,
		delFunct.bind(this, callback)
	);
}
