
/**
 * An HTMLBuffer is a wrapper for HTML data. It extracts the tags out
 * of a raw byte stream which facilitates access to the data by
 * divorcing content and formatting. 
 * 
 * @param {Object} openTagsStart an array of Tags that contains the tags
 * 		that were already open at the start
 */
function HTMLBuffer(openTagsStart) {
	//Weakly sanitizing the open tags
	if (typeof(openTagsStart) != "undefined" && openTagsStart != null) {
		this.openTagsStart = openTagsStart;
	} else {
		this.openTagsStart = new Array();
	}
	
	//An array of Tags that contains the tags that are still open at the end 
	this.openTagsEnd = new Array();
	this.openTagsEnd = this.openTagsEnd.concat(this.openTagsStart);
	
	//Tags that should be inserted into the plain bytes 
	this.tags = new Array();
	//The actual data of the buffer, cleansed of all tags
	this.plainBytes = new Array(); 
}

HTMLBuffer.prototype.loadFromSaveState = function(data) {
	//We split the data around the ";"
	var fields = data.split(";");
	
	//At first we fetch the openTags on start
	var i = 0;
	var end = i + parseInt(fields[i]); i++;
	for (; i <= end; i+=1) {
		var tag = unescape(fields[i]);
		this.openTagsStart.push(new Tag(tag, 0));
	}
	//Then we decode the openTags on end
	var end = parseInt(fields[i]) + i;
	for (; i <= end; i+=1) {
		var tag = unescape(fields[i]);
		this.openTagsEnd.push(new Tag(tag, 0));
	}
	//Then we decode the intra tags
	var end = i + parseInt(fields[i]); i++;
	for (; i <= end; i+=2) {
		var tag = unescape(fields[i]);
		var pos = parseInt(fields[i+1]);
		this.tags.push(new Tag(tag, pos));
	}
	
	//Fetching the storage type of the data
	var storeType = fields[i++];
	
	//Checking the storageType of the data
	switch(storeType) {
		case "null":
			//There are no plain text bytes
			this.plainBytes = new Array();
			i++;
			break;
		case "hex":
			this.plainBytes = hexToBytes(fields[i++]);
			break;
		case "base64":
			this.plainBytes = base64ToBytes(fields[i++]);
			break;
		case "base91":
			this.plainBytes = base91ToBytes(fields[i++]);
			break;
		case "zLibBase64":
			var comp = base64ToBytes(fields[i++]);
			new Inflate().uncompress(this.plainBytes, comp, false);
			break;
		case "zLibBase91":
			var comp = base91ToBytes(fields[i++]);
			new Inflate().uncompress(this.plainBytes, comp, false);
			break;
	}
}

HTMLBuffer.prototype.getSaveState = function() {
	// Use an array + join to avoid O(n²) string concatenation during tag serialization.
	var parts = [];

	//Writing out the openTags on start
	parts.push(this.openTagsStart.length + ";");
	for (var i = 0; i < this.openTagsStart.length; i+=1) {
		parts.push(escape(this.openTagsStart[i].toString()) + ";");
	}
	//Writing out the openTags on end
	parts.push(this.openTagsEnd.length + ";");
	for (var i = 0; i < this.openTagsEnd.length; i+=1) {
		parts.push(escape(this.openTagsEnd[i].toString()) + ";");
	}
	//Writing out the tags
	parts.push((this.tags.length * 2) + ";");
	for (var i = 0; i < this.tags.length; i+=1) {
		parts.push(escape(this.tags[i].toString()) + ";");
		parts.push(this.tags[i].position + ";");
	}

	// Store plain bytes as uncompressed base91.
	// We deliberately avoid zlib compression here: Deflate.compress() at
	// level 9 is O(n * 32768) in pure JavaScript — on the HP TouchPad it
	// takes several seconds per 4KB chunk, making a 200KB book take 5+
	// minutes. base91 with no compression is fast and the DB size overhead
	// (~23%) is well within webOS's 5MB WebSQL limit.
	// loadFromSaveState() handles both "base91" and legacy "zLibBase91"
	// entries, so previously imported books still open correctly.
	if (this.plainBytes.length > 0) {
		parts.push("base91;");
		parts.push(bytesToBase91(this.plainBytes) + ";");
	} else {
		parts.push("null;;");
	}

	return parts.join("");
}

/**
 * Adds the content of the bytes array to the buffer.
 * @param {Array} bytes an array of bytes that should be read in.
 * @param {Boolean} ignoreTags if true, the HTML Buffer will not parse
 * 		the tags from the stream and treat the bytes as plain-text
 */
HTMLBuffer.prototype.addBytes = function(bytes, ignoreTags) {
	//Checking if we deal with plain-text
	if (ignoreTags) {
		concatArray(this.plainBytes, bytes);
		return 0;
	}
	//We must parse HTML tags
	var html = HTMLParser.parseBytes(bytes, this.openTagsEnd);
	//Adding the decoded data to our own arrays
	concatArray(this.plainBytes, html.plainBytes);
	concatArray(this.tags, html.tags);
	this.openTagsEnd = html.openTagsEnd;
	
	//And at last, we return the number of bytes we dropped
	return html.droppedBytes;
}


/**
 * Returns the length of the plain text after all tags are removed
 */
HTMLBuffer.prototype.getLength = function() {
	return this.plainBytes.length;
}

/**
 * Returns three arrays of bytes containing the rich text for the given range.
 * If length is omitted, the range is set to the end of the data. If both
 * range and start is omitted, the whole content of the HTMLBuffer is returned.
 * @param {Object} start the staring position.
 * @param {Object} length the end position.
 * @return an object containing three arrays of bytes. startTags, body and entTags.
 */
HTMLBuffer.prototype.getRichText = function(start, length) {
	//console.log("Buffer getRichText called");
	//Sanitizing
	if (typeof(start) == "undefined") start = 0;
	if (typeof(length) == "undefined") length = this.getLength();
	start = Math.max(0, start);
	length = Math.min(length, this.getLength() - start);
	
	//Now we check if this buffer actually contains plain bytes
	if (this.getLength() <= 0) {
		//This is a buffer that only contains tags! Returning them all
		var body = new Array();
		for (var i = 0; i < this.tags.length; i+=1) {
			var tag = this.tags[i];
			concatArray(body, stringToBytes(tag.toString(true)));
		}
		return {
			startTags: new Array(),
			body: body,
			bodyPlainBytesNum: 0,
			endTags: new Array()
		}
	}
	
	//Fetching the open tags for the starting position
	var openTags = this.getOpenTagsForPos(start);
	
	//Fetching the open tags for the start
	var startTags = new Array();
	for (var i = 0; i < openTags.length; i+=1) {
		var tag = openTags[i];
		concatArray(startTags, stringToBytes(tag.toString(true)));
	}
	
	//Then, we push the plain text data
	var numPlainBytes = 0;
	var body = new Array();
	var currTagPos = 0;
	var currTag = (this.tags.length > 0) ? this.tags[0] : null;
	var currByte = start;
	//We check for length >= 0, instead of > 0, because there might still be
	//tags after the last raw byte
	while (currTag != null && length > 0) {
		//Checking if we need to insert a tag
        if (currByte > currTag.position) {
            //Skipping over this tag
            currTagPos += 1;
			currTag = (currTagPos < this.tags.length)
                ? this.tags[currTagPos] : null;
			continue;
        } else if (currByte == currTag.position) {
			//Inserting the tag; do note that there are special tag translations
			concatArray(body, stringToBytes(currTag.toString(true)));
			//Checking if we can close an open tag
			HTMLParser.addToOpenTagArray(openTags, currTag);
			//Moving one tag further
			currTagPos += 1;
			currTag = (currTagPos < this.tags.length)
                ? this.tags[currTagPos] : null;
			continue;
		}
		if (length <= 0) {
			//We pushed the last tags, but don't need more real bytes
			break;
		}
		//Streaming the intervening bytes into the buffer
		var len = Math.min(length, currTag.position - currByte);
		concatArray(body, this.plainBytes.slice(currByte, currByte + len));
        //currByte = currTag.position;
		currByte += len;
		length -= len;
		numPlainBytes += len;
	}
	
	//Streaming the remaining bytes into the buffer, if there are any
	if (length > 0 && currByte < this.plainBytes.length) {
		var len = Math.min(length, this.plainBytes.length - currByte);
		concatArray(body, this.plainBytes.slice(currByte, currByte + len));
		numPlainBytes += len;
	}
	
	//And printing the closing tags
	var endTags = new Array();
	for (var i = openTags.length - 1; i >= 0 ; i -= 1) {
		var tag = openTags[i];
        var cTag = tag.getClosingClone();
		concatArray(endTags, stringToBytes(cTag.toString(true)));
	}
	
	//At last, we return the three buffers
	return {
		startTags: startTags,
		body: body,
		bodyPlainBytesNum: numPlainBytes,
		endTags: endTags
	}
}

HTMLBuffer.prototype.getOpenTagsForPos = function(pos) {
	var open = new Array();
	open = open.concat(this.openTagsStart);
	
	for (var i = 0; i < this.tags.length; i+=1) {
		var tag = this.tags[i];
		//Checking if we've exceeded the position
		if (pos <= tag.position) {
			break;
		}
		//Checking if we can close an open tag, or must open a new one
		HTMLParser.addToOpenTagArray(open, tag);
	}
	//We return the open tag list
	return (open == null) ? this.openTagsStart : open;
}

HTMLBuffer.prototype.getOpenTagsEnd = function(pos){
	return this.openTagsEnd;
}

