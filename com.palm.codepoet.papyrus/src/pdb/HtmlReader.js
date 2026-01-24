HtmlReader.chunkSize = 4096;

function HtmlReader(reader, callback) {
    //Storing the parameters
    this.reader = reader;
    this.callback = callback;
	
	this.currPos = 0;
	this.chunks = new Array();
	this.chunkEnds = new Array();
	this.length = 0;
	
	//This is an array of name-data tuples that stores the
	//images referenced in this file (data encoded as array of bytes).
	//The list is read & filled during parse() 
	this.images = new Array();
	
	this.parse();
}

//An HtmlReader implements the ByteReader interface
HtmlReader.prototype = new ByteReader();


HtmlReader.prototype.parse = function(state) {
	console.log("parse; pos = " + this.currPos + "; state = " + state);
	if (typeof(state) == "undefined") { state = 0; }
	if (typeof(this.dropMode) == "undefined") { this.dropMode = 0; }
	if (typeof(this.dropStack) == "undefined") { this.dropStack = new Array(); }
	if (typeof(this.dropCall) == "undefined") { this.dropCall = null; }
	if (typeof(this.byteBuf) == "undefined") { this.byteBuf = new Array(); }
	if (typeof(this.filterBytes) == "undefined") { this.filterBytes = new Array(); }
	
	//We check if we've read enough data
	if (this.currPos >= this.reader.getLength()) {
		//We've read enough; calling the image reader
		this.readImages(0);
		//At last, we purge all the variables
		this.dropMode = undefined;
		this.dropStack = undefined;
		this.dropCall = undefined;
		this.byteBuf = undefined;
		this.filterBytes = undefined;
		return;
	}
	
	//We fetch the next chunk of bytes
	var bytes = this.reader.read(this.currPos, HtmlReader.chunkSize);
	
	var escape = false;
	for (var i = 0; i < bytes.length; i+=1) {
		var b = bytes[i];
		switch(state) {
			case 0:
				//Gobbling bytes up to a tag start
				if (b == 0x3C) {
					//We start a tag
					state = 1;
					break;
				}
				//Otherwise we gobble bytes
				if (this.dropMode == 0 || this.dropMode == 3) {
					//We replace \r and \n linebreaks with spaces
					if (b == 0x0A || b == 0x0D) {
						this.filterBytes.push(0x20);
					} else {
						this.filterBytes.push(b);
					}
				}
				break;
			case 1:
				//Gobbling bytes up to a tag end
				switch(b) {
					case 0x22: //A double-quote
						this.byteBuf.push(b);
						state = 2;
						break;
					case 0x27: //A single-quote
						this.byteBuf.push(b);
						state = 3;
						break;
					case 0x3E: //A Tag end ">"
						//Creating a tag from the byteBuf, if not empty
						if (this.byteBuf.length <= 0) {
							state = 0;
							break;
						}
						var str = bytesToString(this.byteBuf);
						//console.log("Tag: " + str);
						//Creating the tag
						var tag = new Tag(str, this.filterBytes.length);
						if (tag == null || tag.name == null || tag.name.length <= 0) {
							//console.log("Aborting tagStr: " + str);
							//Cleansing the byte buffer since the tag's shot
							this.byteBuf.length = 0;
							//And resetting the state
							state = 0;
							//And finally aborting this tag
							break;
						}
						//Checking if we're in a drop mode, or treat tags normally
						if (this.dropMode > 0) {
							//Handling the dropping/replacing of the tag
							var replacement = this.handleDropTag(tag);
							if (replacement != null) {
								for (var k = 0; k < replacement.length; k+=1) {
									concatArray(this.filterBytes,
										stringToBytes(replacement[k].toString())
									);	
								}
							}
							//Now, we check if we can return to non-drop mode
							if (this.dropStack.length <= 0) {
								this.dropMode = 0; this.dropCall = null;
							}
						} else {
							//Checking if the tag defines a named anchor
							if (!(tag.closing)) {
								var attr = tag.getAttribute("name");
								if (attr && attr.value) {
									//There is a name attribute, inserting a link anchor
									concatArray(this.filterBytes,
										stringToBytes("<a name=\"" + attr.value + "\"></a>")
									);
								}
							}
							//Handling the tag
							var handle = this.handleTag(tag);
							switch (handle.state) {
								case 0:
									//Adding the tag to the bytes
									concatArray(this.filterBytes,
										stringToBytes(tag.toString())
									);
									break;
								case 1:
									//Removing just this tag by ignoring it
									break;
								case 2:
									//Entering full drop mode
									this.dropMode = 2;
									this.dropStack = handle.stack;
									break;
								case 3:
									//Entering drop & replace mode
									this.dropMode = 3;
									this.dropStack = handle.stack;
									this.dropCall = handle.callback;
									break;
								case 4:
									//Replacing the tag with the stack
									for (var z = 0; z < handle.stack.length; z+=1) {
										concatArray(this.filterBytes,
											stringToBytes(handle.stack[z])
										);
									}
									break;
							}
						}
						//Cleansing the byte buffer since a full tag was completed
						this.byteBuf.length = 0;
						//And resetting the state
						state = 0;
						break;
					default:
						//Gobbling bytes into the buffer
						this.byteBuf.push(b);
						break;
				}
				break;
			case 2: //Double quote searcher
				this.byteBuf.push(b);
				if (b == 0x5C) {
					//Parsed an escape char
					escape = true;
				} else if (escape == false && b == 0x22) {
					//End of quote
					state = 1;
				} else {
					//Resetting escapement
					escape = false;
				}
				break;
			case 3: //Single quote searcher
				this.byteBuf.push(b);
				if (b == 0x5C) {
					//Parsed an escape char
					escape = true;
				} else if (escape == false && b == 0x27) {
					//End of quote
					state = 1;
				} else {
					//Resetting escapement
					escape = false;
				}
				break;
			
		}
	}
	//We add the filtered bytes to our chunks list
	if (this.filterBytes.length > 0) {
		this.chunks.push(this.filterBytes);
		this.length += this.filterBytes.length;
		this.chunkEnds.push(this.length);
		//And we fetch a new filterBytes array
		this.filterBytes = new Array();
	}
	
	//We move ahead
	this.currPos += bytes.length;
	
	//And we call ourselves deferred to parse the next block
	this.parse.bind(this, state).defer();
}

HtmlReader.prototype.handleDropTag = function(tag) {
	//We check if the tag's a closer for the stack
	var index = this.dropStack.indexOf(tag.name);
	//Checking if we're in replace mode
	if (this.dropMode == 3 && typeof(this.dropCall) != "undefined" &&
			this.dropCall != null) {
		//Replacing the tag
		var replacedTag = this.dropCall(tag);
		if (replacedTag != null) {
			return replacedTag;
		}
	}
	//Checking if the tag's in the stack
	if (index < 0) {
		return null;
	}
	
	//Checking if the tag's an opener, or closer
	if (tag.closing) {
		//We remove that tag from the stack
		this.dropStack.splice(index, 1);
	} else if (tag.single == false) {
		//Damn, another such tag, putting it onto stack
		this.dropStack.push(tag.name);
	}
	return null;
}

/**
 * Handles a single tag by analyzing it and returning one of the
 * following three action-selectors:
 * 0: Add the tag to the stream and continue parsing normally
 *    If the passed "tag" was changed, the changed tag is used
 * 1: Remove this tag, and JUST this tag
 * 2: Remove this tag and all the bytes in between till the
 *    returned stack of tag names is empty 
 * 3: Same as 2, but don't remove *plain* bytes; call function "callback" on dropped tags
 * 4: The "stack" contains a number of tags/strings that replace the original tag
 * @param {Object} tag
 * @return an object with two elements: A numbered return value "state", 
 * 		an array of strings called "stack" (may be null) and a
 * 		callback function for state 3 (may be null)
 */
HtmlReader.prototype.handleTag = function(tag) {
	var retVal = { state: 0, stack: null, callback: null };
	if (typeof(tag) == "undefined" || tag == null) {
		return retVal;
	}
	
	switch(tag.name) {
		// ~~~ Tags that are completely dropped with content ~~~
		case "head":
		case "script":
		case "style":
			//We remove the tag and all the bytes till a closer was parsed
			if (tag.single) {
				//A single tag has no closer or content, we use state 1
				retVal.state = 1;
			} else {
				//Normal, add the name to the stack and use state 2
				retVal.state = 2;
				retVal.stack = [tag.name];
			}
			break;
		// ~~~ Tags that are modified ~~~
		case "a":
			//<a>'s are stripped down to their href attribute.
			//The "name" attribute was already extracted earlier
			if (!(tag.closing)) {
				var attr = tag.getAttribute("href");
				if (attr && attr.value) {
					tag.content = "href=\"" + attr.value + "\"";
				} else {
					//Dropping the invalid tag
					retVal.state = 1;
				}
			}
			break;
		case "ol":
			//Ordered (numbered) lists are turned into unordered lists
			retVal.state = 4;
			if (tag.closing) {
				retVal.stack = ["</ul>"];
			} else {
				retVal.stack = ["<ul>"];
			}
			break;
		case "p":
			//<p>'s are replaced with <br>
			retVal.state = 4;
			//retVal.stack = (tag.closing) ? ["<br/><br/>"] :  ["<br/>"];
			retVal.stack = ["<br/>"];
			break;
		 case "img":
		 	//An image tag gets reformatted as <img label="path">
			//where the path is the full path+name of the file
			//Closing tags are not manipulated
			if (tag.single || tag.closing == false) {
				var src = tag.getAttribute("src");
				if (src == null || src.value.length <= 0) { break; }
				//Crudely checking if the source is absolute/remote or relative
				if (src.value.startsWith("http://") || src.value.startsWith("file://") || 
						src.value.startsWith("/")) {
					tag.content = "label=\"" + src.value + "\"";
				} else {
					//We deal with a relatively addressed file; prepending path,
					//if available
					if (!(this.reader.getPathname)) { break; }
					src.value = this.reader.getPathname() + "/" + src.value;
					tag.content = "label=\"" + src.value + "\"";
				}
			}
			//And adding the src to our images array to be read later
			this.images.push({ name: src.value, data: null });
		 	break;
		// ~~~ Tags whose enclosed content is dropped and replaced ~~~
		case "table":
			if (tag.single) {
				//A single tag has no closer or content, we use state 1
				retVal.state = 1;
			} else {
				retVal.state = 3;
				retVal.stack = [tag.name];
				retVal.callback = this.replaceTableTags.bind(this);
			}
			break;
		// ~~~ Tags that are copied verbatim ~~~
		case "b": case "i": case "big": case "small":
		case "br": case "bdo": case "center": case "hr": case "strong":
		case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": 
		case "strike": case "sub": case "sup":  case "u": case "li":
			//We don't need to change the defaults
			break;
		
		// ~~~ All other tags are dropped as they are ~~~
		default:
			retVal.state = 1;
			break;
			
	}
	
	return retVal;
}

HtmlReader.prototype.replaceTableTags = function(tag) {
	var retTag = null;
	switch (tag.name) {
		case "td":
			//Closers are converted to a "; "
			if (tag.closing == true) {
				retTag = [ new Tag("; ", tag.position, true) ];
			}
			break;
		case "tr":
			//Closers are converted to a <br/><br/>
			if (tag.closing == true) {
				retTag = [
					new Tag("br/", tag.position),
					new Tag("br/", tag.position),
				];
			}
			break;
		case "ol":
			//Ordered (numbered) lists are turned into unordered lists
			if (tag.closing) {
				retTag = [ new Tag("/ul", tag.position)];
			} else {
				retTag = [ new Tag("ul", tag.position)];
			}
			break;
		//Some standard tags are kept
		case "b": case "i": case "a": case "big": case "small":
		case "br": case "bdo": case "center": case "hr": case "strong":
		case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": 
		case "strike": case "sub": case "sup":  case "u": case "li":
			retTag = [ tag ];
			break;
		default:
			//All other tags are removed
			retTag = null;
			break;
	}
	return retTag;
}

/**
 * This method will read the images array and try to associate the
 * stored names with data
 */
HtmlReader.prototype.readImages = function(pos) {
	console.log("HtmlReader.readImages: " + pos);
	//Checking if we've processed all images
	if (pos < 0 || pos >= this.images.length) {
		this.callback(this.reader, this);
		return;		
	}
	//The handler for the file opening
	var handleFile = function(pos, file) {
		//We check if the file is valid
		if (file != null && file.ready && file.getLength() > 0) {
			console.log("Image data was present!");
			//We actually have read a file. Base64ing & storing it
			this.images[pos].data = file.read(0, file.getLength());
		}
		//We call readImages deferred to fetch the next image
		this.readImages.bind(this, pos+1).defer();
	}
	//We open the image file
	var src = this.images[pos].name;
	//Reading the file and calling our file handler
	new File(src, handleFile.bind(this, pos));
}

/**
 * This method reads 'len' bytes from the HTML file.
 *
 * @param {Number} start the position of the byte that should be read.
 * @param {Number} len the number of bytes that should be read.
 *         If len is not specified 1 should be assumed.
 */
HtmlReader.prototype.read = function(start, len) {
    //console.log("Will read " + len + " bytes @ " + start)
    //Checking if len was assigned
    if (!len) len = 1;
    //Sanitizing start and len
    start = Math.floor(start);
    len = Math.floor(len);
    
    //Now we load the data of the records till we've completely filled the buffer
    var buf = new Array();
    var bytePos = start;
    //We find the start and end chunk
    var startChunk = this.getChunkNumForByte(start);
	var endChunk = this.getChunkNumForByte(start + len);
	//Sanity checks
    if (startChunk < 0) { return null; }
	if (endChunk < 0) { endChunk = this.chunks.length - 1; }
	
	//console.log("Chunks: " + startChunk + " - " + endChunk)
	
	
	//We calculate the offset for the first chunk
	var offset = (startChunk == 0) ? start : start - this.chunkEnds[startChunk-1];
    //Now, we can fetch data from the chunks
    for (var num = startChunk; num <= endChunk; num +=1) {
        //Adding data from that chunk to the buffer
		var maxLen = Math.min(len, this.chunks[num].length - offset);
		if (maxLen > 0) {
			concatArray(buf, this.chunks[num].slice(offset, offset + maxLen));	
		}
		len -= maxLen;
		//We only need the offset for the first chunk
		offset = 0;
    }
    //Now, we return the buffer
    return buf;
}

/**
 * Returns whether or not this byteReader's read() function
 * is asynchronous or synchronous. In other words, if this
 * function returns true, the read() function returns immediately
 * and will actually call the callback function when the data
 * arrives. 
 */
HtmlReader.prototype.readIsAsync = function() {
    return false;
}


HtmlReader.prototype.getChunkNumForByte = function(pos) {
	//console.log("getChunkNumForByte; pos = " + pos);
	//TODO: Use binary search later on
	if (pos < 0) return -1;
	for (var i = 0; i < this.chunkEnds.length; i+=1) {
		if (pos < this.chunkEnds[i]) {
			return i;
		}
	}
	//If we reach this, no chunk matched
	return -1;
}

/**
 * Returns the length of the uncompressed underlying stream.
 */
HtmlReader.prototype.getLength = function() {
    //The total length is stored in the first DOC-header's records
    return this.length;
}

/**
 * Closes the input stream.
 */
HtmlReader.prototype.close = function(){
    //Does nothing yet
}

/**
 * Returns the data content of the image with the given label.
 * @param {Object} label the name of the image; in this case
 * 		it's the record number in which the image is stored
 * @return an array of bytes.
 */
HtmlReader.prototype.getImage = function(label) {
	console.log("HtmlReader.getImage: " + label);
	//We check if that label references a stored image
	for (var i = 0; i < this.images.length; i+=1) {
		if (this.images[i].name == label) {
			//We found the image, returning the data
			console.log("Image data was present!");
			return this.images[i].data;
		}
	}
	return null;
}
