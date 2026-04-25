EpubReader.chunkSize = 4096;

function EpubReader(zipFile, callback, controller) {
    //Storing the parameters
    this.zip = zipFile;
	this.zipFileName = zipFile.getBasename();
    this.callback = callback;
	this.controller = controller;
	
	//Throughout this file, we deal with xml files, creating an xml parser
	this.parser = new DOMParser();
	
	//The structure of this file
	this.structure = {
		rootfiles: new Array(),
		rfData: new Array()
	};
	
	//The rootfile / chapter offsets
	this.offsets = new Array();
	
	//This is an array of name-data tuples that stores the
	//images referenced in this file (data encoded as array of bytes).
	//The list is read & filled during parse() 
	this.images = new Array();
	
	//We check the validity of the zip container
	var valid = this.checkValidity();
	if (!valid) {
		//The file wasn't valid, aborting
		this.setStreamFailure();
		return;
	}
	
	//Now, we check if it's an encrypted file
	var valid = this.checkEncryption();
	if (!valid) {
		//The file wasn't decrypted successfully, we show
		//a suitable error message and abort
		this.displayEncryptionError();
		return;
	}
	
	//Now, we fetch the structure of the document to read
	valid = this.getStructure();
	if (!valid) {
		//Structure parsing failed, aborting
		this.setStreamFailure();
		return;
	}
	
	
	//Now, we process the OPF rootfiles; note that we
	//do this asynchronously;
	this.parseRootfiles.bind(this, 0).defer();
}

//An EpubReader implements the ByteReader interface
EpubReader.prototype = new ByteReader();



// ~~~ EXTRACTION OF RAW DATA ~~~

EpubReader.prototype.setStreamOK = function() {
	//We calculate the byte offsets of each chapter
	this.offsets.length = 0;
	var currOff = 0;
	for (var r = 0; r < this.structure.rfData.length; r+=1) {
		var root = this.structure.rfData[r];
		for (var c = 0; c < root.chapters.length; c += 1) {
			var chap = root.chapters[c];
			//Storing the offset
			this.offsets.push({
				start: currOff,
				len: chap.data.length,
				root: r,
				chapter: c
			});
			//Calculating the new offset
			currOff += chap.data.length;
		}
	}
	
	//We don't need the zip object anymore
	var lZip = this.zip;
	this.zip = null;
	//TODO: We should do a basic sanity check here
	
	//Callback with ourselves signifies success
	this.callback(lZip, this);
}

EpubReader.prototype.setStreamFailure = function() {
	//We don't need the zip object anymore
	var lZip = this.zip;
	this.zip = null;
	//Callback with null signifies failure
	this.callback(lZip, null);
}

/**
 * Returns the given file as a UTF-8 string.
 * @param {Object} name the name of the file
 * @return a string containing the text, or null on failure.
 */
EpubReader.prototype.getTextFile = function(name) {
	//console.log("Trying to retrieve: " + name);
	//We try to retrieve
	var file = this.zip.getFile(name);
	if (file == null || file.file == null) {
		//No such file or decompression error
		console.warn("ZIP/Decompression error!");
		return null;
	} else {
		file = file.file;
	}
	//Fetching the data of that file
	var bytes = file.uncompress();
	if (bytes == null || bytes.length <= 0) {
		console.warn("Uncompressing failed!");
		return null;
	}
	//Now, we convert the bytes into a UTF-8 string,
	//treating it as HTML (we don't replaces \n\r with <br/>)
	var text = HTMLParser.bufferToHTML(bytes, 2, true);
	if (text.text == null) {
		return null;
	} else {
		return text.text;
	}
}

/**
 * Checks if the file is a valid ePub document
 */
EpubReader.prototype.checkValidity = function() {
	//Trying to read the mimetype file
	var mimeFile = this.zip.getFile("mimetype");
	//Checking if the file's there
	if (mimeFile == null || mimeFile.file == null) {
		//No such file or decompression error
		console.log("Mimetype file not present. No ePub?");
		return false;
	} else {
		mimeFile = mimeFile.file;
	}
	//Checking if the file's not too big. It should be == 20 byte
	if (mimeFile.uSize < 20) {
		console.log("Mimetype file's uSize is not 20 bytes long.");
		console.log("Instead: " + mimeFile.uSize);
		return false;
	}
	//Fetching the data of that file
	var bytes = mimeFile.uncompress();
	if (bytes == null || bytes.length < 20) {
		console.log("Mimetype file is not 20 bytes long");
		console.log("Instead: " + bytes.length);
		return false;
	}
	//Checking if the mimetype is: "application/epub+zip"
	//Note: Some ePub's are damaged by automatic line-conversion, and have
	//a "\r\n", "\n" or just "\r" at its end
	if (bytesToString(bytes.slice(0,20)) != "application/epub+zip") {
		console.log("Mimetype is not application/epub+zip");
		console.log("Instead: " + bytesToString(bytes));
		return false;
	}
	//If the file has survived these tests, it should be a valid ePub file
	return true;
}

/**
 * Checks if the file's encrypted. Later on, this function should
 * also handle fetching the user credentials and decryption details.
 */
EpubReader.prototype.checkEncryption = function() {
	//Trying to read the META-INF/encryption.xml file
	var encFile = this.zip.getFile("META-INF/encryption.xml");
	//Checking if the file's there
	if (encFile == null || encFile.file == null) {
		//No such file, good, that means the file's shouldn't have DRM
		return true;
	} else {
		//The file is probably encrypted, we currently can't do anything
		console.warn("EPub file is most likely encrypted.");
		return false; 
	}
}

/**
 * Retrieves the structure of the ePub and returns
 * whether or not this was successful.
 */
EpubReader.prototype.getStructure = function() {
	//We try to retrieve the container (OPS) file
	var text = this.getTextFile("META-INF/container.xml");
	//We drop the namespaces from the OPF file
	text = text.replace(/xmlns=\"[^\"]*\"/g, "");
	//Checking if it succeeded
	if (text == null) { return false; }
	//We fetch the DOM tree of the file
	var xmlDoc = this.parser.parseFromString(text, "text/xml");
	//We fetch all container/rootfiles/rootfile tags
	var rootfiles = xmlDoc.getElementsByTagName("rootfile");
	if (rootfiles == null || rootfiles.length <= 0) {
		return false;
	}
	//Now, we add all the rootfiles with a suitable media type
	for (var i = 0; i < rootfiles.length; i+=1) {
		//media-type="application/oebps-package+xml" />
		var rf = rootfiles[i];
		if (rf == null) continue;
		var mediatype = rf.getAttribute("media-type");
		var path = rf.getAttribute("full-path");
		if (path && mediatype == "application/oebps-package+xml") {
			//It's a valid rootfile
			this.structure.rootfiles.push(path);
		}
	}
	//We check if we parsed at least one root file
	if (this.structure.rootfiles.length > 0) {
		return true;
	} else {
		return false;
	}
}

/**
 * Parses all the OPF root files specified in the structure.
 */
EpubReader.prototype.parseRootfiles = function(pos) {
	//Checking if we've parsed all necessary root files
	if (pos >= this.structure.rootfiles.length) {
		//console.log("Done fetching rootfiles");
		//Checking if there's a text segment defined
		if (this.structure.rfData.length <= 0) {
			this.setStreamFailure();
			return;
		}
		//Otherwise, we can decompress the data files
		//We defer this, to make it more unlikely for WebOS
		//to kill us.
		this.getDataContent.bind(this).defer();
		return;
	}
	
	//Fetching the rootfile
	var rfFullPath = this.structure.rootfiles[pos];
	var rfPath = File.extractPathname(rfFullPath);
	if (rfPath.length > 0) { rfPath += "/"; }
	var text = this.getTextFile(rfFullPath);
	//Checking if it succeeded
	if (text == null) {
		//An error occurred, we attempt to read the next file
		this.parseRootfiles.bind(this, pos+1).defer();
		return;
	}
	//Creating an xmldoc from this text
	var xmlDoc = this.parser.parseFromString(text, "text/xml");
	
	//Creating a new rootfile object
	var data = {
		title: null,
		creator: null,
		language: null,
		chapters: new Array(),
		images: new Array()
	}
	
	//Fetching the title, creator and language
	var tag = xmlDoc.getElementsByTagName("title")[0];
	if (tag != null && tag.firstChild != null) {
		data.title = tag.firstChild.nodeValue;
	}
	var tag = xmlDoc.getElementsByTagName("creator")[0];
	if (tag != null && tag.firstChild != null) {
		data.creator = tag.firstChild.nodeValue;
	}
	tag = xmlDoc.getElementsByTagName("language")[0];
	if (tag != null && tag.firstChild != null) {
		data.language = tag.firstChild.nodeValue;
	}
	
	//Now, we check if there's a spine TOC that rearranges the chapters
	var spine = xmlDoc.getElementsByTagName("spine");
	var spineOrder = new Array();
	if (spine) {
		//Fetching manifest items
		var spineItems = spine[0].getElementsByTagName("itemref");
		for (var i = 0; i < spineItems.length; i += 1) {
			var item = spineItems[i];
			var idref = item.getAttribute("idref");
			if (!idref) { continue; }
			//Otherwise, we remember to reorder that entry
			spineOrder.push({ id: idref, pos: spineOrder.length });
		}
	}
	
	//Fetching the manifest, that describes chapters and images
	var manifest = xmlDoc.getElementsByTagName("manifest");
	if (!manifest) {
		//An error occurred, we attempt to read the next file
		this.parseRootfiles.bind(this, pos+1).defer();
		return;
	}
	//Fetching manifest items
	var manItems = manifest[0].getElementsByTagName("item");
	for (var i = 0; i < manItems.length; i+=1) {
		var item = manItems[i];
		var entry = {
			id : item.getAttribute("id"),
			href: rfPath + item.getAttribute("href"),
			type: item.getAttribute("media-type"),
			data: null //This is filled at a later point
		}
		//We check the type
		if (entry.type.startsWith("image/")) {
			data.images.push(entry);
		} else if (entry.type == "application/xhtml+xml") {
			//We check if there's a fixed position from the spine
			var inserted = false;
			for (var j = 0; j < spineOrder.length; j += 1) {
				if (spineOrder[j].id == entry.id) {
					data.chapters[spineOrder[j].pos] = entry;					
					inserted = true;
					break;
				}
			}
			//If the entry wasn't inserted from the spine, we append it
			if (!inserted) {
				if (data.chapters.length < spineOrder.length) {
					data.chapters.push(entry);
				} else {
					data.chapters[spineOrder.length] = entry;
				}
			}
		}
	}
	
	//Checking if the entry makes sense and adding it to the structure
	if (data.chapters.length > 0) {
		this.structure.rfData.push(data);
	}
	//Now, we fetch the next root file
	this.parseRootfiles.bind(this, pos+1).defer();
}

EpubReader.prototype.getDataContent = function(state) {
	if (!state) {
		state = { mode: 1, root: 0, subNum: 0 };
	}
	//Checking if we're done
	if (state.mode > 2 || state.root >= this.structure.rfData.length) {
		//Calling the filtering of the markup
		this.filterMarkup();
		return;
	}
	
	//Now, we create the load worker that adds data to entries
	//and then calls this fetcher again
	var loadWorker = function(state, entry, data) {
		//console.log("Loaded compressed data.");
		//Sanity check & assigning the data
		if (entry != null) {
			entry.data = data;
		}
		var root = this.structure.rfData[state.root];
		//Modifying the state for the data content fetcher
		if (state.mode == 1) {
			if (state.subNum >= root.chapters.length - 1) {
				state.subNum = 0;
				state.mode = 2;
			} else {
				state.subNum += 1;
			}
		} else {
			if (state.subNum >= root.images.length - 1) {
				state.root +=1;
				state.subNum = 0;
				state.mode = 1;
			} else {
				state.subNum += 1;
			}
		}
		//Calling the fetcher for the next fragment
		this.getDataContent.bind(this, state).defer();
	}
	
	//Loading the root file
	var root = this.structure.rfData[state.root];
	
	//Checking if we should parse chapters or images
	var load = (state.mode == 1)
		? root.chapters[state.subNum]
		: root.images[state.subNum];
	//Checking if that entry has a valid href
	if (!load || !load.href) {
		//Fetching the next fragment
		loadWorker.bind(this, state, null, null).defer();
		return;
	}
	//Now, we decompress and add the data from that file
	var zipped = this.zip.getFile(load.href);
	//Sanity checking the zipped file
	if (zipped == null || zipped.error != 0) {
		//Invalid / non-existent file
		load.data = null;
		//Fetching the next fragment
		loadWorker.bind(this, state, null, null).defer();
	} else {
		//We asynchronously decompress, and call the loadWorker afterwards
		zipped.file.uncompressAsync(loadWorker.bind(this, state, load));	
	}
}



// ~~~ ERROR MESSAGES ~~~

EpubReader.prototype.displayEncryptionError = function() {
	var msg = "This ePub file seems to be DRM protected." +
		" At the moment, pReader does not support such ePub files.";
	if (this.controller) {
		this.controller.showAlertDialog( {
			onChoose: function(value) {
				this.setStreamFailure();
			}.bind(this),
			title: "DRMed ePub file",
			message: msg,
			choices: [{
				label: $L('Okay'),
				value: "okay",
				type: 'negative'
			}, ]
		});
	} else {
		this.setStreamFailure();
	}
}



// ~~~ MARKUP FILTERING METHODS ~~~

EpubReader.prototype.filterMarkup = function() {
	//Creating a synchronizer for the load
	var synchronizer = new Mojo.Function.Synchronize(
		{ syncCallback: this.setStreamOK.bind(this) }
	);
	
	//Filtering all chunks of all chapters
	for (var r = 0; r < this.structure.rfData.length; r += 1) {
		var root = this.structure.rfData[r];
		//Fetching the chapters
		for (var c = 0; c < root.chapters.length; c += 1) {
			var chap = root.chapters[c];
			//Since each chapter is filtered in an asynchronous manner,
			//we pass an empty, wrapped "onSuccess" method to the filtering
			//process.
			var doNothing = function() {};
			var onSuccessWrap = synchronizer.wrap(doNothing);
			//Now, we defer-start the filtering of this chapter
			this.filterChapter.bind(this, chap, onSuccessWrap).defer();
		}
	}
}

EpubReader.prototype.filterChapter = function(chapter, callback, state) {
	//Checking if the common parsing state is sane
	if (typeof(state) == "undefined" || state == null) {
		state = {
			currPos: 0,
			filterData: new Array(),
			actionStack: new Array(),
			extraBytes: new Array()
		};
	}
	
	//We check if we've finished filtering the chapter
	if (state.currPos >= chapter.data.length) {
		//We replace the original data with the filtered data
		chapter.data = state.filterData;
		//And we call the callback, to signify success
		callback();
		return;
	}
	
	//We fetch another chunk of the original data and prepend it
	//with the bytes that were left by the last round 
	var len = Math.min(
		EpubReader.chunkSize,
		chapter.data.length - state.currPos
	);
	concatArray(state.extraBytes, chapter.data.slice(
		state.currPos, state.currPos + len)
	);
	//Increasing the currPos by the number of newly fetched bytes
	state.currPos += len;
	
	//We parse the XHTML from that file
	var html = HTMLParser.parseBytes(state.extraBytes, null, true);
	var plainPos = 0;
	for (var i = 0; i < html.tags.length; i+=1) {
		var tag = html.tags[i];
		var noStreamTag = false;
		
		//We determine the drop mode from the action stack
		var dropMode = this.getModeFromStack(state.actionStack);
		switch(dropMode) {
			//~~~ Normal mode, add the plainBytes
			case 0:
				//We fetch the intermediate bytes
				if (plainPos < tag.position) {
					var bytes = html.plainBytes.slice(plainPos, tag.position);
					concatArray(state.filterData, bytes);					
				}
				break;
			//~~~ Drop all plain bytes 
			default:
			case 1:
				break;
		 	//~~~ Drops plain bytes AND tags
			case 2:
				noStreamTag = true;
				break;
		}
		
		//Now, we process the tag
		switch(tag.name) {
			//~~~ Tags that are dropped, without dropping or doing anything else
			case "span":
				noStreamTag = true;
				break;
			//~~~ Tags that are dropped, along with all interior text & tags
			case "head": case "script": case "style": case "svg":
				noStreamTag = true;
				if (tag.closing) {
					//Removing the tag from the action stack
					this.dropFromStack(state.actionStack, tag.name);
				} else if (!tag.single) {
					//Adding the tag to the action stack
					state.actionStack.push({ tag: tag.name, mode: 2 });
				}
				break;
				
			//~~~ Tags that drop interior text
				// NONE YET
				
			//~~~ Tags that are dropped only on their own
			case "xml": case "!doctype": case "html": case "meta": case "body":
			case "tbody": case "pre": case "blockquote": case "code": case "link":
				noStreamTag = true;
				break;
				
			//~~~ Table tags are replaced
			case "table":
				if (noStreamTag) { break; }
				//Always adding a <br/>
				concatArray(state.filterData, [ 0x3C, 0x62, 0x72, 0x2F, 0x3E ]);
				noStreamTag = true;
				break;
			case "tr":
				if (noStreamTag) { break; }
				//Adding a <br/> only on opening tags
				if (!tag.closing) {
					concatArray(state.filterData, [ 0x3C, 0x62, 0x72, 0x2F, 0x3E ]);					
				}
				noStreamTag = true;
				break;
			case "td":
				if (noStreamTag) { break; }
				//Adding a single space
				state.filterData.push(0x20);
				noStreamTag = true;
				break;
				
			//~~~ <p> tags are ugly and replaced with one <br/>; if opening, we add a tab
			case "p":
				if (noStreamTag) { break; }
				concatArray(state.filterData, [ 0x3C, 0x62, 0x72, 0x2F, 0x3E ]);
				if (!tag.closing) {
					state.filterData.push(0x09);
				}
				noStreamTag = true;
				break;
			
			//~~ <div> and <hX> tags might contain an id label, which must be anchored
			case "div": case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
				if (noStreamTag) { break; }
				if (tag.closing) { break; }
				attr = tag.getAttribute("id");
				if (attr != null && attr.value != null) {
					//It is an anchor, adding an <a> tag
					concatArray(state.filterData, stringToBytes("<a name=\"" + attr.value + "\">"));
					concatArray(state.filterData, [ 0x3C, 0x2F, 0x61, 0x3E ]);
					break;
				}
				break;
				
			//~~~ Internal link and anchor tags must be modified a small bit
			case "a":
				if (noStreamTag) { break; }
				if (tag.closing) { break; }
				attr = tag.getAttribute("href");
				if (attr != null && attr.value != null) {
					var sharpIndex = attr.value.lastIndexOf("#");
					if (sharpIndex > 0) {
						//We must strip the file reference
						tag.content = "href=\"" + attr.value.substr(sharpIndex) + "\"";
					}
					break;
				}
				//Otherwise, we check if it's an anchor
				attr = tag.getAttribute("id");
				if (attr != null && attr.value != null) {
					//It is an anchor, we replace the "id" with "name"
					tag.content = "name=\"" + attr.value + "\"";
					//If it's single, we must also generate a closer
					if (tag.single) {
						noStreamTag = true;
						concatArray(state.filterData, stringToBytes(tag.toString()));
						concatArray(state.filterData, [ 0x3C, 0x2F, 0x61, 0x3E ]);
					}
					break;
				}
				break;
			//~~~ img tags are transposed into <img label> tags
			case "img":
				if (noStreamTag) { break; }
				if (tag.closing) { break; }
				attr = tag.getAttribute("src");
				if (attr != null && attr.value != null) {
					//We rename src into label
					tag.content = "label=\"" + attr.value + "\"";
				} else {
					//Otherwise we drop the tag
					noStreamTag = true;
				}
				//Furthermore, we add a space after each image
				//This is because of a nasty design flaw in the PageFitter
				//TODO: THIS IS A HACK
				if (!noStreamTag) {
					concatArray(state.filterData, stringToBytes(tag.toString()));
					state.filterData.push(0x20);
				}
				noStreamTag = true;
				break;
		}
		//Now, we check if we should add the tag to the stream
		if (!noStreamTag) {
			concatArray(state.filterData, stringToBytes(tag.toString()));
		}
		//Setting the plainPos to the position of the parsed tag
		plainPos = tag.position;
	}
	
	//At the end, we check if we still need to stream plain bytes
	var dropMode = this.getModeFromStack(state.actionStack);
	if (dropMode == 0 && plainPos < html.plainBytes.length) {
		var bytes = html.plainBytes.slice(plainPos);
		concatArray(state.filterData, bytes);		
	}
	
	//If a tag was open at the end of the file, we must re-read it in the next loop
	if (html.droppedBytes > 0) {
		state.extraBytes = chapter.data.slice(state.currPos - html.droppedBytes, state.currPos);		
	} else {
		state.extraBytes.length = 0;
	}
	//At the end, we call ourselves deferred to filter the next chunk
	this.filterChapter.bind(this, chapter, callback, state).defer();
}

EpubReader.prototype.getModeFromStack = function(actionStack) {
	var mode = 0;
	for (var i = 0; i < actionStack.length; i+=1) {
		mode = Math.max(mode, actionStack[i].mode);
	}
	return mode;
}

EpubReader.prototype.dropFromStack = function(actionStack, tagname) {
	for (var i = 0; i < actionStack.length; i+=1) {
		var actionTag = actionStack[i].tag;
		if (actionTag == tagname) {
			actionStack.splice(i, 1);
			return;
		}
	}
}



// ~~~ METADATA RETRIEVAL ~~~

EpubReader.prototype.getName = function() {
	if (this.structure.rfData.length > 0) {
		var rf = this.structure.rfData[0];
		if (rf != null) {
			//Creator is optional
			var str = null;
			if (rf.creator != null) {
				str = rf.creator + " - ";
			}
			//But the title isn't
			str += rf.title;
			//Checking if that results in a valid name
			if (str != null && str.length > 0) {
				return str;
			} else {
				//The file was malformed by not specifying a name
				//Falling back to the filename
				return this.zipFileName;
			}
		}
	}
	return null;
}

EpubReader.prototype.getMetadata = function() {
	if (this.structure.rfData.length <= 0) {
		return null;
	}
	var rf = this.structure.rfData[0];
	var metadata = {
		title : rf.title,
		author : rf.creator,
		language : rf.language,
		publisher : rf.publisher
	}
	return metadata;
}

/**
 * Returns the cover image data as a base64 data URL, or null if no cover found.
 * Looks for cover in this order:
 * 1. Image with id containing "cover"
 * 2. First image in the manifest
 */
EpubReader.prototype.getCoverImage = function() {
	if (this.structure.rfData.length <= 0) {
		return null;
	}

	var rf = this.structure.rfData[0];
	if (!rf.images || rf.images.length === 0) {
		return null;
	}

	var coverImage = null;

	// Look for an image with id containing "cover"
	for (var i = 0; i < rf.images.length; i++) {
		var img = rf.images[i];
		if (img.id && img.id.toLowerCase().indexOf("cover") !== -1) {
			coverImage = img;
			break;
		}
	}

	// Fall back to first image
	if (!coverImage) {
		coverImage = rf.images[0];
	}

	// Check if we have data
	if (!coverImage || !coverImage.data || coverImage.data.length === 0) {
		return null;
	}

	// Convert to base64 data URL
	var mimeType = coverImage.type || "image/jpeg";
	var base64 = this.bytesToBase64(coverImage.data);

	return "data:" + mimeType + ";base64," + base64;
}

/**
 * Convert byte array to base64 string.
 * Uses chunked String.fromCharCode.apply to avoid O(n²) string concatenation
 * on older JavaScript engines.
 */
EpubReader.prototype.bytesToBase64 = function(bytes) {
	// Build binary string in 8KB chunks to avoid stack overflow with .apply
	// and avoid O(n²) behavior from repeated string concatenation.
	var CHUNK = 8192;
	var parts = [];
	for (var i = 0; i < bytes.length; i += CHUNK) {
		var slice = (bytes.subarray)
			? bytes.subarray(i, i + CHUNK)
			: bytes.slice(i, i + CHUNK);
		parts.push(String.fromCharCode.apply(null, slice));
	}
	var binary = parts.join("");

	if (typeof btoa === "function") {
		return btoa(binary);
	}

	// Manual base64 encoding fallback — accumulate into array then join once
	// to avoid O(n²) string concatenation.
	var base64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var result = [];
	var j = 0;
	while (j < binary.length) {
		var a = binary.charCodeAt(j++) || 0;
		var b = binary.charCodeAt(j++) || 0;
		var c = binary.charCodeAt(j++) || 0;

		var b1 = (a >> 2) & 0x3F;
		var b2 = ((a & 0x3) << 4) | ((b >> 4) & 0xF);
		var b3 = ((b & 0xF) << 2) | ((c >> 6) & 0x3);
		var b4 = c & 0x3F;

		if (isNaN(b)) {
			b3 = b4 = 64;
		} else if (isNaN(c)) {
			b4 = 64;
		}

		result.push(base64chars.charAt(b1));
		result.push(base64chars.charAt(b2));
		result.push(b3 === 64 ? "=" : base64chars.charAt(b3));
		result.push(b4 === 64 ? "=" : base64chars.charAt(b4));
	}
	return result.join("");
}

// ~~~ TEXT & IMAGE RETRIEVAL ~~~

/**
 * This method reads 'len' bytes from the ePub file.
 *
 * @param {Number} start the position of the byte that should be read.
 * @param {Number} len the number of bytes that should be read.
 *         If len is not specified 1 should be assumed.
 */
EpubReader.prototype.read = function(start, len) {
	//console.log("EpubReader.read: " + start);
    //TODO: This simple linear search HAS to be improved later on
	var buf = new Array();
	for (var i = 0; i < this.offsets.length; i+=1) {
		var off = this.offsets[i];
		if (start >= off.start && start < off.start + off.len) {
			//Figuring out the offset & length INSIDE the chapter
			var iOff = start - off.start;
			var iLen = Math.min(len, off.len - iOff);
			//Streaming bytes into our buffer
			var chap = this.structure.rfData[off.root].chapters[off.chapter];
			concatArray(buf, chap.data.slice(iOff, iOff + iLen));
		}
		//Checking if we've buffered enough
		if (buf.length >= len) { break; }
	}
	return buf;
}

/**
 * Returns whether or not this byteReader's read() function
 * is asynchronous or synchronous. In other words, if this
 * function returns true, the read() function returns immediately
 * and will actually call the callback function when the data
 * arrives. 
 */
EpubReader.prototype.readIsAsync = function() {
    return false;
}

/**
 * Returns the length of the uncompressed underlying stream.
 */
EpubReader.prototype.getLength = function() {
    var last = this.offsets.last();
	return last.start + last.len;
}

/**
 * Closes the input stream.
 */
EpubReader.prototype.close = function(){
    //Does nothing yet
}

/**
 * Returns the data content of the image with the given label.
 * @param {Object} label the name of the image
 * @return an array of bytes.
 */
EpubReader.prototype.getImage = function(label) {
	/* TODO: Pathes to images are handled weirdly in ePub
	 * The image files are defined with their full path, but
	 * inside the files, they are referenced with a relative
	 * path. With the current design of the pReader, this
	 * can only be handled by stripping all paths.
	 */ 
	//console.log("EpubReader.getImage: " + label);
	var labelBase = File.extractBasename(label);
	//We check if that label references a stored image
	for (var r = 0; r < this.structure.rfData.length; r+=1) {
		var root = this.structure.rfData[r];
		for (var i = 0; i < root.images.length; i += 1) {
			var img = root.images[i];
			var imgBase = File.extractBasename(img.href);
			if (imgBase == labelBase) {
				//console.log("Found image!");
				return img.data;
			}
		}
	}
	console.warn("No such image: " + label);
	return null;
}
