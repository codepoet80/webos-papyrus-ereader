
/** The size of each chunk in plain-text bytes. */
HTMLBook.chunkSize = 16384;
/** How far to hunt for the end of a runaway tag before giving up and
 *  skipping a plain chunk instead. Only reached on malformed books. */
HTMLBook.RUNAWAY_TAG_SCAN_MAX = 2097152;

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

	//The import that owns this book, or null when loading an already-imported
	//book from the DB for reading.  Gates the deferred chain below so a
	//cancelled import stops dead and a thrown step reports an error (F1/F2).
	this.importSession = ImportSession.capture();

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

	//Byte offsets (in this book's continuous stream) where a new
	//chapter/spine-item starts. PageFitter uses these to force a page
	//break at each chapter boundary instead of flowing chapters together.
	//Populated from the reader's own chapter offsets on import (see
	//readFromReader's finish()) and persisted via save/decodeMetaData.
	this.chapterBreaks = new Array();

	//Buffers queued for a batched write during import (see saveBufferData).
	this._pendingWrites = new Array();
	this._pendingBytes = 0;

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
	//Absent in books imported before chapter-break metadata existed -
	//falls back to no forced page breaks, matching their original import.
	this.chapterBreaks = meta.chapterBreaks || [];

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

	// P0 instrumentation: one count per chunk cycle (see IMPORT-REWORK-PLAN.md).
	if (typeof window !== "undefined" && window.ImportStats) { window.ImportStats.count("chunks", 1); }

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
				this.progressCallback("Processing text " + pct + "%");
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
		//Chapter boundaries in PLAIN-TEXT space (tags stripped) - the same
		//coordinate system this.length uses (see HTMLBuffer.getLength()).
		//Built up incrementally below as import naturally crosses each
		//chapter's raw-byte end.
		this.chapterBreaks = [0];
		//Chapter boundaries are ALWAYS recorded, regardless of the "Apply
		//chapter breaks" preference. That preference controls DISPLAY only
		//(PageFitter.chapterBreaksEnabled, set from EpubRenderer).
		//
		//Gating capture here as well was a design mistake: boundaries live in
		//the book's stored metadata, so a book imported while the preference
		//was off had NO boundary data, and turning the preference on later did
		//nothing until the book was re-imported. Recording them always costs
		//about 3% more chain steps and no extra timers (harness: Star Trek
		//458 -> 474 steps, 27 -> 26 timers), which is a fair price for a
		//setting that simply works when toggled.
	}

	//Saving the current loading position
	this.currLoadPos = currPos;
	
	//What to do after the last chunk has been read and all buffers flushed
	var finish = function(){
		//console.log("Calling finish.");
		//this.chapterBreaks was already built incrementally as chunks were
		//read (see below) - nothing to do here but discard the reader.
		this.reader = null;
		//We signify that we're ready
		this.isReady = true;

		//Flush any batched buffer writes BEFORE the metadata record. The
		//metadata is what makes a book openable, so it must be the last
		//thing written - a book whose content write was interrupted then
		//simply fails to open, instead of opening and rendering garbage.
		var self = this;
		this.flushPendingWrites(function() {
			self.saveMetaData();

			//console.log("The book has a length of: " + self.getLength());

			//And we call our callback
			self.callback(self);
		});
	}.bind(this);

	//console.log("Reading chunk for pos " + currPos);
	//Land this read exactly on a chapter boundary (raw markup-byte space -
	//see reader.offsets) WHEN one falls within normal chunkSize reach, so
	//we can detect a clean crossing below without any extra parsing pass.
	//Reads still take the FURTHEST reachable boundary, not the nearest one:
	//several small chapters (a cover page, a title page, a two-line "part"
	//divider, ...) get batched into one read+DB-write exactly as before,
	//instead of each paying its own full read/parse/write round-trip -
	//that per-chapter fragmentation was a real, measured import slowdown
	//(see fix #19's import-pipeline performance warning). Only the
	//boundary at the END of each read's batch is captured precisely; any
	//boundary swallowed mid-batch (only possible between very small,
	//already-adjacent chapters) doesn't get its own forced page break, a
	//low-cost trade next to the fragmentation cost of always breaking here.
	//A chunk that lands inside one large chapter (the common case) is
	//completely unaffected - no boundary is reachable, so it just gets the
	//normal chunkSize as before.
	var reqLen = HTMLBook.chunkSize;
	var chapterBoundaryReached = -1;
	if (this.reader && this.reader.offsets && this.reader.offsets.length > 0) {
		var maxReach = currPos + HTMLBook.chunkSize;
		for (var ci = 0; ci < this.reader.offsets.length; ci++) {
			var boundary = this.reader.offsets[ci].start;
			if (boundary <= currPos) continue;
			if (boundary > maxReach) break; //offsets are sorted ascending
			chapterBoundaryReached = boundary; //keep the furthest reachable one
		}
		if (chapterBoundaryReached > 0) {
			reqLen = Math.max(1, chapterBoundaryReached - currPos);
		}
	}

	//Trying to read another chunk
	var byteBuf = this.reader.read(currPos, reqLen);
	if (byteBuf == null || byteBuf.length <= 0) {
		finish();
		return;
	}

	//console.log("Read " + byteBuf.length + " bytes");

	//Constructing an HTMLBuffer from that chunk
	var buffer = new HTMLBuffer(openTags);
	var dropped = buffer.addBytes(byteBuf, this.readerIsPlainText);

	//Checking if the document ends malformed on an open tag
	var reachedChapterEnd = false;
	if (byteBuf.length - dropped <= 0) {
		// Nothing in this chunk parsed. That means a SINGLE tag is longer than
		// the whole chunk - in practice a big inline data: URI. This used to be
		// treated as "the document ends malformed here" and finish() silently
		// discarded the entire rest of the book: the import reported success
		// and the reader simply never saw the remaining chapters (audit F8).
		// Only finish when genuinely at the end; otherwise step over the
		// oversized tag and keep going.
		var streamLen = (this.reader.getLength) ? this.reader.getLength() : 0;
		if (currPos + byteBuf.length >= streamLen) {
			finish();
			return;
		}
		// Find where the runaway tag actually closes so we skip the tag rather
		// than a fixed window - otherwise its tail would land in the next chunk
		// and be rendered to the reader as raw base64 text.
		var skipTo = -1, scanned = 0, probe, pi;
		while (scanned < HTMLBook.RUNAWAY_TAG_SCAN_MAX) {
			probe = this.reader.read(currPos + scanned, HTMLBook.chunkSize);
			if (!probe || probe.length <= 0) { break; }
			for (pi = 0; pi < probe.length; pi++) {
				if (probe[pi] === 0x3E) { skipTo = currPos + scanned + pi + 1; break; }
			}
			if (skipTo >= 0) { break; }
			scanned += probe.length;
		}
		if (skipTo < 0) { skipTo = currPos + byteBuf.length; }
		enyo.error("HTMLBook: tag larger than one chunk at " + currPos +
			"; skipping " + (skipTo - currPos) + " bytes to keep the rest of the book");
		// Open tags are unreliable across a skipped span; reset rather than
		// carry state that no longer matches the stream.
		ImportSession.deferStep(this.importSession,
			this.readFromReader.bind(this, skipTo, null, true));
		return;
	} else {
		//Moving forward in the stream, but fetching the dropped chars again
		currPos += byteBuf.length - dropped;
		//A clean landing exactly on chapterBoundaryReached (no dropped
		//trailing bytes) means this chunk's plain-text length, once added
		//to this.length below, is exactly the next chapter's start position.
		reachedChapterEnd = (chapterBoundaryReached > 0 && currPos === chapterBoundaryReached &&
			chapterBoundaryReached < this.reader.getLength());
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
						// Negative-cache the miss. Some books ship broken/zero-byte
						// images (Cognition in the Wild has 36, referenced 395 times
						// between them). Without this, EVERY reference repeats the
						// linear getImage() scan, the warn, and - because
						// breakForWebOS stays true - a full ~10ms defer. See audit F13.
						enyo.warn("Image data invalid/empty: " + label);
						this.imgNameBuffer.push(label);
						breakForWebOS = false;
						break;
					}
					// On webOS, btoa() is O(n²) for large byte arrays — skip images above
					// 1MB to prevent multi-hour import hangs. Matches getCoverImage() guard.
					if (typeof window !== 'undefined' && window.PalmSystem && bytes.length > 1048576) {
						enyo.warn("HTMLBook: image too large (" + Math.round(bytes.length/1024) + "KB) for webOS, skipping");
						this.imgNameBuffer.push(label);
						breakForWebOS = false;
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
					this.imgNameBuffer.push(label);
					this.bookDB.write(name, bytes);
				} else {
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
		ImportSession.deferStep(this.importSession, self.bind(this, buffer, pos+1, self, callback));
	}
	
	var storeWorker = function(buffer, currPos, openTags, reachedChapterEnd) {
		openTags = buffer.getOpenTagsEnd();

		this.bufferOffsets[this.numBuffers] = this.length;
		this.length += buffer.getLength();
		this.numBuffers += 1;

		if (reachedChapterEnd) {
			this.chapterBreaks.push(this.length);
		}

		this.saveBufferData(this.numBuffers - 1, buffer,
			this.readFromReader.bind(this, currPos, openTags, true)
		);
	}

	//We call the tagWorker, which calls the storeWorker, which calls
	//this function again. Isn't Javascript fun?
	ImportSession.deferStep(this.importSession, tagWorker.bind(this, buffer, 0, tagWorker,
		storeWorker.bind(this, buffer, currPos, openTags, reachedChapterEnd)
	));
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
	//Sanity check
	if (typeof(callback) == "undefined") {
		enyo.error("HTMLBook.read() absolutely needs a callback.")
		return null;
	}
	if (start < 0 || length < 0 || start > this.getLength()) {
		callback([]);
		return null;
	}
	//Sanitizing the length
	length = Math.min(length, this.getLength() - start);

	//At first, we determine which buffers we must get
	var startChunk = this.getBufferContainment(start);
	var endChunk = this.getBufferContainment(start + length);

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
	//Saving the chapterBreaks array
	meta += this.chapterBreaks.length + ";";
	for (var i = 0; i < this.chapterBreaks.length; i+=1) {
		meta += this.chapterBreaks[i] + ";";
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

	//Decoding the chapterBreaks array. Absent in books saved before this
	//field existed - dbOpenLoad falls back to [] in that case.
	if (i >= fields.length) { return meta; }
	var end = i + parseInt(fields[i]); i++;
	meta.chapterBreaks = new Array();
	if (end < fields.length) {
		for (; i <= end; i += 1) {
			meta.chapterBreaks.push(parseInt(fields[i]));
		}
	}

	return meta;
}

/**
 * Returns the byte offset where the chapter containing 'pos' ends (i.e.
 * the start of the next chapter), or this book's total length if 'pos'
 * is in the last chapter / no chapter boundaries are known.
 */
HTMLBook.prototype.getChapterEnd = function(pos) {
	var breaks = this.chapterBreaks;
	for (var i = 0; breaks && i < breaks.length; i += 1) {
		if (breaks[i] > pos) { return breaks[i]; }
	}
	return this.length;
}

/**
 * Returns the byte offset where the chapter containing 'pos' starts,
 * or 0 if 'pos' is in the first chapter / no chapter boundaries are known.
 */
HTMLBook.prototype.getChapterStart = function(pos) {
	var breaks = this.chapterBreaks;
	var result = 0;
	for (var i = 0; breaks && i < breaks.length; i += 1) {
		if (breaks[i] <= pos) { result = breaks[i]; } else { break; }
	}
	return result;
}

/**
 * Saves the given buffer under the given number.
 * @param {Object} bufferNum the number in the database that will be assigned.
 * @param {Object} buffer the HTMLBuffer that should be stored.
 */
/** Max buffers held before a batch flush. Bounds both transaction count
 *  and how much encoded text we keep in memory at once. */
HTMLBook.WRITE_BATCH_COUNT = 8;
/** Max encoded bytes held before a batch flush, so books with very large
 *  chunks do not balloon memory while waiting to reach the count. */
HTMLBook.WRITE_BATCH_BYTES = 262144;

HTMLBook.prototype.saveBufferData = function(bufferNum, buffer, callback) {
	//console.log("Saving Buffer Data for " + bufferNum);
	var name = "t" + bufferNum;
	var save = buffer.getSaveState();

	// During an IMPORT, batch buffer writes into one transaction per group.
	// Each WebSQL transaction is a disk flush on webOS, and a book produces
	// one per chunk - the dominant cost of the storage phase. Reading a book
	// (no import session) keeps the original write-through path untouched,
	// since loadBufferData must be able to read anything already saved.
	if (this.importSession && !this.importSession.cancelled) {
		this._pendingWrites.push({ name: name, value: save });
		this._pendingBytes += save.length;
		if (this._pendingWrites.length >= HTMLBook.WRITE_BATCH_COUNT ||
			this._pendingBytes >= HTMLBook.WRITE_BATCH_BYTES) {
			this.flushPendingWrites(callback);
		} else if (callback) {
			callback(true);
		}
	return;
	}

	if (typeof(callback) != "undefined" && callback != null) {
		this.bookDB.write(name, save, callback);
	} else {
		this.bookDB.write(name, save);
	}
}

/**
 * Writes any buffers queued by saveBufferData in a single transaction.
 * Always invokes the callback, even when there is nothing to flush.
 */
HTMLBook.prototype.flushPendingWrites = function(callback) {
	var batch = this._pendingWrites;
	this._pendingWrites = [];
	this._pendingBytes = 0;
	if (!batch.length) {
		if (callback) { callback(true); }
		return;
	}
	this.bookDB.writeBatch(batch, function(ok) {
		if (callback) { callback(ok); }
	});
}

/**
 * Loads the buffer with the given number and calls the callback function
 * with the loaded buffer as its argument. Will pass null if no such buffer
 * is present.
 * @param {Object} bufferNum the number of the buffer in the DB.
 * @param {Object} callback the function to call once the buffer is loaded.
 */
HTMLBook.prototype.loadBufferData = function(bufferNum, callback) {
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
				//Saving this data as our last buffered image
				this.lastImageData = data[0];
				this.lastImageLabel = label;
				callback(data[0]);
			} else {
				//Failure to load
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
