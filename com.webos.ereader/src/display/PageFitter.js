
function PageFitter(book, offscreenElement, encoding) {
	//We start with the very first page
	this.currStart = 0;
	this.currEnd = -1;
	
	//Setting the offscreen buffer to write our test data
	this.offscreen = offscreenElement;
	//And storing the book
	this.book = book;
	//And its encoding
	this.encoding = encoding;
	
	//this.cnt = 0;
}

PageFitter.prototype.setEncoding = function(encoding) {
	this.encoding = encoding;
}

PageFitter.prototype.getNextPage = function(size, callback) {
	//Checking if we can go to the next page, or must re-render the current page
	if (this.currStart < 0) {
		this.currStart = 0;
	}
	if (this.currEnd < 0) {
		//Invalid end supplied, redrawing current page
		this.currEnd = this.currStart;
	}
	if (this.currEnd >= this.getLength()) {
		//We return null because there is no next page
		callback(null);
		return;
	}
	
	//Moving to the next page (may be the same, see above)
	this.currStart = this.currEnd;
	
	console.log("getNextPage: start = " + this.currStart + "; end = " + this.currEnd);
	
	//Getting the next page in forward-mode & returning it through handlePage
	this.fitPageForward(size, this.currEnd,
		this.handlePage.bind(this, size, callback)
	);
}

PageFitter.prototype.getCurrPage = function(size, callback) {
	console.log("getCurrPage: start = " + this.currStart + "; end = " + this.currEnd);
	//Getting a page in forward-mode & returning it through handlePage
	this.fitPageForward(size, this.currStart,
		this.handlePage.bind(this, size, callback)
	);
}

PageFitter.prototype.getPrevPage = function(size, callback) {
	//Checking if we can go to the prev page at all
	if (this.currStart > this.getLength()) {
		this.currStart = this.getLength();
	}
	if (this.currStart <= 0) {
		//We return null because there is no previous page
		callback(null);
		return;
	}
	//We can render the previous page
	this.currEnd = this.currStart;
	
	console.log("getPrevPage: start = " + this.currStart + "; end = " + this.currEnd);
	
	//Getting the prev page in backward-mode & returning it through handlePage
	this.fitPageBackward(size, this.currEnd,
		this.handlePage.bind(this, size, callback)
	);
}

/**
 * Use this function to fetch the previous, current next page
 * without leaving the current page.
 * @param {Object} size the vertical size of the screen area
 * @param {Object} callback a function to call with the assembled page
 */
PageFitter.prototype.getTriplePage = function(size, callback) {
	if (this.currStart > this.getLength()) {
		this.currStart = this.getLength();
	}
	if (this.currEnd < 0) { this.currEnd = 0; }
	
	//Defining the assembly function
	var assemblyFunc = function(elemName, buffer, callback, text){
		//console.log("getTriplePage::assembyFunc: " + elemName);
		//Writing into the buffer and undoing the move
		buffer[elemName] = text;
		buffer[elemName + "Start"] = this.currStart;
		buffer[elemName + "End"] = this.currEnd;
		
		if (buffer.oldStart == 0 && buffer.oldEnd == 0) {
			//We have just loaded the first page from a "cold" start
			//where the size of the page was not yet known; correcting that
			buffer.oldStart = this.currStart;
			buffer.oldEnd = this.currEnd;
		} else if (buffer.oldStart == this.currStart) {
			//Found a better page end
			buffer.oldEnd = this.currEnd;
		} else {
			//We don't want to move the limits
			this.currStart = buffer.oldStart;
			this.currEnd = buffer.oldEnd;
		}
		//And calling the callback
		callback();
	}
	//Defining the page buffer
	var buffer = new Object();
	//Because don't want to move, we back-up the current positions
	buffer.oldStart = this.currStart;
	buffer.oldEnd = Math.max(this.currStart, this.currEnd);
	
	//Creating the assembly binds in reverse order
	var frontFunc = assemblyFunc.bind(
			this, "front", buffer, callback.bind(this,buffer)
	);
	var midFunc = assemblyFunc.bind(
			this, "mid", buffer, this.getNextPage.bind(this, size, frontFunc)
	);
	var backFunc = assemblyFunc.bind(
			this, "back", buffer, this.getCurrPage.bind(this, size, midFunc)
	);
	//Calling the succession of the above functions
	this.getPrevPage(size, backFunc);
}

PageFitter.prototype.gotoPage = function(pos,sanitizePosition) {
	//console.log("gotoPage");
	//Sanitizing the position
	pos = Math.max(0, pos);
	pos = Math.min(this.getLength(), pos);
	//Assigning this position
	this.currStart = pos;
	this.currEnd = -1;
	this.sanitizePosition = sanitizePosition;
}

PageFitter.prototype.getLength = function() {
	return this.book.getLength();
}

PageFitter.prototype.handlePage = function(size, callback, start, len) {
	console.log("handlePage");
	//We set the new page starts & ends
	this.currStart = start;
	this.currEnd = start + len;
	
	//console.log("PF: Now on page " + this.currStart + "-" + this.currEnd);
	
	//And fetching a buffer of that size & calling the callback
	this.readReplaceAndFit(
		size, this.currStart, len,
		this.returnPage.bind(this, callback)
	);
}

PageFitter.prototype.returnPage = function(callback, buffer) {
	console.log("returnPage");
	//Reducing our currEnd appropriately
	this.currEnd -= buffer.dropped;
	

	//console.log("PF: Now on page " + this.currStart + "-" + this.currEnd);
	
	//And returning the text
	callback(buffer.text);
}

PageFitter.prototype.handleImages = function(size, text, callback){
	//console.log("handleImages");
	//Extracting the img tags from the stream
	var imgs = text.match(/<img[\s]+label=\"[\S]+\"[\s]*\/*>/g);
	//Checking if there were img tags
	if (imgs == null || imgs.length <= 0) {
		callback(text);
		return;
	}
	console.log("PageFitter: Found image tags in the stream");
	
	//The function that inserts the tags into the string
	var insertTag = function(size, textObj, cntrObj, cntrTarget,
			callback, origTag, newTag) {
		console.log("insertTag");
		//We replace the old tag with the new tag
		if (newTag == null) newTag = "";
		textObj.val = textObj.val.replace(origTag, newTag);
		//We increase the number of processed objects
		cntrObj.val += 1;
		//And we check if we're done
		if (cntrObj.val >= cntrTarget) {
			callback(textObj.val);
		}
	}
	
	var textObj = { val: text };
	var cntrObj = { val: 0 };
	var cntrTarget = imgs.length;
	
	//Fetching img labels, creating their tags and calling insertTag
	for (var i = 0; i < imgs.length; i += 1) {
		var label = imgs[i].match(/\"[\S]+\"/)[0];
		label = label.slice(1, label.length - 1);
		//With the label, we can get the img data
		this.book.getImage(label,
			this.handleImage.bind(this, size,
				insertTag.bind(this, size, textObj, cntrObj, cntrTarget,
					callback, imgs[i]
				)
			)
		);
	}
}

PageFitter.prototype.handleImage = function(size, callback, data) {
	console.log("handleImage");
	// Limit image height to 60% of screen to leave room for text
	var maxImageHeight = Math.floor(size * 0.6);

	//The height getter function
	var getHeight = function(maxHeight, img, callback) {
		if (img == null) {
			callback(null);
			return;
		}
		var h = img.height;
		var w = img.width;

		// Scale image to fit within maxHeight while maintaining aspect ratio
		if (h > maxHeight) {
			var scale = maxHeight / h;
			h = maxHeight;
			w = Math.floor(w * scale);
		}

		// Also limit width to screen width (assume ~900px usable)
		var maxWidth = 900;
		if (w > maxWidth) {
			var scale = maxWidth / w;
			w = maxWidth;
			h = Math.floor(h * scale);
		}

		callback("<img src=\"" + img.src + "\" width=\"" + w + "\" height=\"" + h + "\" style=\"display:block;margin:10px auto;\" />");
	}
	//Creating an image
	var img = new Image();
	img.src = "data:image;base64," + data;
	img.onload = getHeight.bind(this, maxImageHeight, img, callback);
	img.onerror = getHeight.bind(this, maxImageHeight, null, callback);
}

/**
 * Checks if the text in the given buffer fits into the given size.
 * @param {Object} buf
 * @param {Object} size
 */
PageFitter.prototype.bufferFitsSize = function(size, buffer) {
	//console.log("bufferFitsSize");
	//Converting the buffer to a string
	var html = HTMLParser.bufferToHTML(buffer, this.encoding);
	var text = html.text;
	var dropped = html.dropped;
	//console.log("Dropped " + dropped + " bytes on fit.")
	//Updating the offscreen buffer
	this.offscreen.innerHTML = text || "";
	//Fetching the height of the rendered text in the offscreen buffer
	var offsetHeight = this.offscreen.offsetHeight;
	//Returning if the height of the offscreen buffer exceeds the window size
	
	//console.log("Size = " + size + "; OffHeight = " + offsetHeight);
	
	return {
		dropped: dropped,
		fits: offsetHeight < size
	}
}

/**
 * This method reads data from the stream, inserts images and then checks
 * if the buffer fits into the given size.
 * @param {Object} size
 * @param {Object} start
 * @param {Object} len
 * @param {Object} callback
 */
PageFitter.prototype.readReplaceAndFit = function(size, start, len, callback) {
	//console.log("readReplaceAndFit");
	var params = {
		size: size, callback: callback
	};
	
	var fitTest = function (params, text) {
		//console.log("fitTest");
		//We check if the returned text fits
		this.offscreen.innerHTML = text || "";
		var offsetHeight = this.offscreen.offsetHeight;
		params.fits = offsetHeight < params.size;
		//After that, we're done and return a reduced object
		params.callback({
			text: text,
			dropped: params.html.dropped,
			fits: params.fits
		});
	}.bind(this, params);
	
	var imagify = function (params, nextFunct, buffer) {
		//console.log("imagify");
		//We convert the buffer to a rich text string
		params.html = HTMLParser.bufferToHTML(buffer, this.encoding);
		//And then we insert the images
		this.handleImages(params.size, params.html.text, nextFunct);
	}.bind(this, params, fitTest);
	
	//At first, we read stream of bytes from the book
	this.book.read(start, len, imagify);
}


PageFitter.prototype.fitPageForward = function(size, start, callback, state, buffer) {
	/*
	console.log(
		"fitPageForward; state = " + state + 
		"; inner = " + this.innerLen + "; outer = " + this.outerLen
	);
	*/
	//$("text").innerHTML = "fitPageForward; state = " + state + "; step = " + this.cnt;
	//this.cnt++;
	
	//Checking if we need to initialize the variables
	if (!state) {
		/* We want to render at least ONE byte
		 * TODO: This is a HACK. This is due to a problem with tags not being
		 * addressed separately. Thus, if so many tags (especially images) are
		 * on the same byte position that they won't all fit on a single page
		 * this method would return (correctly) 0. Unfortunately, this means
		 * that we couldn't scroll back nor forth. But it's clear that
		 * a much saner solution has to be found for this problem. 
		 */ 
		this.innerLen = 1;
		this.outerLen = 512;
		state = (this.sanitizePosition && start > 0) ? -1 : 1;
		this.sanitizePosition = false;
		//state = 1;
	}
	//Set this value to false in the loop when you call this method as a callback
	var abort = false;
	while (!abort) {
		abort = true;
		//Switching to the correct processing state
		switch (state) {
			case -1: // gotoPercent (entered by user) case: Check for start position sanity
				//console.log("sanitizing start position");
				if (!buffer || buffer==null) {
					start-=1; // backup 1 byte to validate we are not within a word
					this.book.read(start, this.outerLen,
						this.fitPageForward.bind(this, size, start, callback, -1)
					);
				} else {
					var dropped = this.findSaneBreak(buffer, 25, true);
					//console.log("sanitized... dropped",dropped);
					if (dropped > 0) start = start + dropped;
					this.readReplaceAndFit(size, start, this.outerLen,
						this.fitPageForward.bind(this, size, start, callback, 1) 
					);
				}
				break;
			case 1: //Initial state
				//Checking if we need to read, or check
				if (!buffer || buffer==null) {
					//We must read, insert images and check if the result fits
					this.readReplaceAndFit(size, start, this.outerLen,
						this.fitPageForward.bind(this, size, start, callback, 1)
					);
				} else {
					//We reduce outerLen by the number of dropped bytes
					this.outerLen -= buffer.dropped; 
					//We check the buffer if it fit
					if (buffer.fits) {
						//Checking if we reached / exceeded the end
						if (start + this.outerLen >= this.getLength()) {
							//We reached the end, and it fit, callback
							callback(start, this.getLength() - start);
							return;
						}
						//We found a fitting buffer, adjusting inner & outer len
						this.innerLen = this.outerLen;
						this.outerLen *= 2;
						//And we fetch a new buffer
						this.readReplaceAndFit(size, start, this.outerLen,
							this.fitPageForward.bind(this, size, start, callback, 1)
						);
					} else {
						//We found an exceeding size, switching state
						abort = false; buffer = null;
						state = 2; 
						//this.fitPageForward(size, start, callback, 2, null);
					}
				}
				break;
			case 2: //We now know the exceeding size, fetching the EXACT size
				//Calculating the middle
				var middle = Math.floor((this.outerLen + this.innerLen) / 2);
				//Checking if we need to read, or check
				if (!buffer || buffer == null) {
					//We must read a new size
					this.readReplaceAndFit(size, start, middle,
						this.fitPageForward.bind(this, size, start, callback, 2)
					);
				} else {
					//We reduce middle by the number of dropped bytes
					this.middle -= buffer.dropped;
					if (buffer.fits) {
						//It fits, setting the inner length
						this.innerLen = middle;
					} else {
						this.outerLen = middle;
					}
					//Checking if we have found the PERFECT middle
					if (this.outerLen - this.innerLen <= 1) {
						//Assigning both to middle
						 middle = this.outerLen = this.innerLen;
						//Switching state
						//this.fitPageForward(size, start, callback, 3, null);
						//abort = false;
						//state = 3;
						this.book.read(start, middle,
							this.fitPageForward.bind(this, size, start, callback, 3)
						);
					} else {
						//Calculating the new middle
						middle = Math.floor((this.outerLen + this.innerLen) / 2);
						//Fetching a new buffer
						this.readReplaceAndFit(size, start, middle,
							this.fitPageForward.bind(this, size, start, callback, 2)
						);
					}
				}
				break;
			case 3: //Sane linebreaks are ensured
				//We see how many chars need to be dropped
				var dropped = this.findSaneBreak(buffer, 25, false);
				//console.log("Dropping " + dropped + " bytes.");
				if (dropped > 0) {
					callback(start, this.outerLen - dropped);
				} else {
					callback(start, this.outerLen);
				}
				break;
		}
	}
}

PageFitter.prototype.fitPageBackward = function(size, end, callback, state, buffer) {
	//console.log("fitPageBackward; state = " + state);
	//Checking if we need to initialize the variables
	if (!state) {
		//TODO: Here we also set the innerLen to 1, due to the same reason as
		//outlined in fitPageForward()
		this.innerLen = 1;
		this.outerLen = 512;
		state = 1;
	}
	//Set this value to false in the loop when you call this method as a callback
	var abort = false;
	while (!abort) {
		abort = true;
		//Switching to the correct processing state
		switch (state) {
			case 1: //Initial state
				//Checking if we need to read, or check
				if (!buffer || buffer == null) {
					//We must read
					var start = Math.max(0, end - this.outerLen);
					this.outerLen = Math.min(end - start, this.outerLen);
					this.readReplaceAndFit(size, start, this.outerLen,
						this.fitPageBackward.bind(this, size, end, callback, 1)
					);
				} else {
					//We check the if the buffer had fit
					if (buffer.fits) {
						var start = Math.max(0, end - this.outerLen);
						//Checking if we reached / exceeded the end
						if (start <= 0) {
							//We reached the start, we fit it into the screen and return
							//console.log("Reached book start on scroll back.");
							this.fitPageForward(size, 0, callback);
							return;
						}
						//We found a fitting buffer, adjusting inner & outer len
						this.innerLen = this.outerLen;
						this.outerLen *= 2;
						//And we fetch a new buffer
						var start = Math.max(0, end - this.outerLen);
						this.readReplaceAndFit(size, start, this.outerLen,
							this.fitPageBackward.bind(this, size, end, callback, 1)
						);
					} else {
						//We found an exceeding size, switching state
						abort = false; buffer = null;
						state = 2;
					}
				}
				break;
			case 2: //We now know the exceeding size, fetching the EXACT size
				//Calculating the middle
				var middle = Math.floor((this.outerLen + this.innerLen) / 2);
				//Checking if we need to read, or check
				if (!buffer || buffer == null) {
					//We must read
					var start = Math.max(0, end - middle);
					this.readReplaceAndFit(size, start, middle,
						this.fitPageBackward.bind(this, size, end, callback, 2)
					);
				} else {
					//We check the buffer if it had fit
					if (buffer.fits) {
						//It fits, setting the inner length
						this.innerLen = middle;
					} else {
						this.outerLen = middle;
					}
					//Calculating the new middle
					middle = Math.floor((this.outerLen + this.innerLen) / 2);
					var start = Math.max(0, end - middle);
					//Checking if we have found the PERFECT middle
					if (this.outerLen - this.innerLen <= 1) {
						//Assigning both to middle
						middle = this.outerLen = this.innerLen;
						//Switching state
						//this.fitPageBackward(size, end, callback, 3, null);
						this.book.read(start, middle,
							this.fitPageBackward.bind(this, size, end, callback, 3)
						);
						break;
					}
					//Fetching a new buffer
					this.readReplaceAndFit(size, start, middle,
						this.fitPageBackward.bind(this, size, end, callback, 2)
					);
				}
				break;
			case 3: //Sane linebreaks are ensured
				var start = Math.max(0, end - this.innerLen);
				var len = end - start;
				//We see how many chars need to be dropped
				var dropped = this.findSaneBreak(buffer, 25, true);
				//console.log("Dropping " + dropped + " bytes.");
				if (dropped > 0) {
					callback(start + dropped, len - dropped);
				} else {
					callback(start, len);
				}
				break;
		}
	}
}


/**
 * Ensures that breaks happen on sane boundaries.
 * @param {Object} buf the buffer to correct
 * @param {Object} maxScrollBack how many characters should be dropped at most.
 * @param {Object} fromStart if chars should be dropped from the start, or the end.
 * @return {Number} the number of bytes that must be dropped for a sane break.
 * 		Will be negative if no sane break was possible within maxScrollBack.
 */
PageFitter.prototype.findSaneBreak = function(buf, maxScrollBack, fromStart) {
	//Sanity check
	if (buf == null) return 0;
	
	//Then we look how many bytes should be dropped
	maxScrollBack = Math.min(maxScrollBack, buf.length);
	var finished = false;
	var dropped = 0;
	var searched = 0;
	var state = 0;
	var pos = (fromStart) ? 0 : buf.length - 1;
	var tagStart = (fromStart) ? 0x3C : 0x3E;
	var tagEnd = (fromStart) ? 0x3E : 0x3C;
	
	while(!finished && dropped < maxScrollBack && (searched++) < 10*maxScrollBack &&
			pos >= 0 && pos < buf.length) {
		var chr = buf[pos];
		if (state == 0) { //Normal gobbling
			if (chr == tagStart) {
				state = 1;
			} else if (chr == 0x26 || chr == 0x3B) {
				//Ampersand and semicolon are not sane breaks due to "&xyz;" codes
				dropped += 1;
			} else if (chr >= 0x20 && chr <= 0x2F) {
				//All punctuation marks are valid stop codes
				finished = true;
			} else if (chr >= 0x0A && chr <= 0x0D) {
				//Linebreaks and tabs are good places to stop
				finished = true;
			} else {
				//Every other char (even if they're punctuation in 8-Bit Codes or UTF8
				//are treated as not a sane place to break
				dropped +=1;
			}			
		} else { //Ignoring tags
			if (chr == tagEnd) { //A tag end
				//Changing state back to 1
				state = 0;
			}
		}
		//Moving pos
		pos += (fromStart) ? 1 : -1;
	}
	//Returning how many non-tag chars must be dropped for sanity
	return (finished) ? dropped : -1;
}

