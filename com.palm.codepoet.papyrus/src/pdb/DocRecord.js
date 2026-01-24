/**
 * Parses the bytes of a palm doc record and decompresses them if necessary.
 * @param isTextData whether or not this is the first header record, or one of
 *        the further text records.
 * @param bytes the bytes of the target record as an array of integers
 * @param headerRecord, a link back to the header, if it's a text record.
 */
function DocRecord(isTextData, bytes, headerRecord, loadAsPlainText, openTags) {
    //Loading the defaults
    this.loadDefaults(isTextData);
    //Checking if there's a byte sequence to parse
    if (!bytes) {
        //Nothing to do anymore
        return;
    }
    //Actually parsing the byte data
    if (isTextData) {
        //Remembering the header
        this.headerRecord = headerRecord;
        //Checking if the text is plain or compressed
		//console.log("PDB Compression flag: " + headerRecord.attribute.compression);
        if (headerRecord.attribute.compression == 1) {
			//We were explicitly told to use uncompressed data
            this.data = bytes;
        } else {
			//Using Palm Doc LZ77 decompression, even if the flag is not
			//exactly "2"
            this.data = new Lz77().decompress(bytes);
        }
		//Now we check if HTML mode is desired
		if (!loadAsPlainText) {
			this.openTags = this.filterMarkup(openTags);
		} else {
			this.openTags = null;
		}
    } else {
        this.parseHeader(bytes);
    }
}

DocRecord.isValidID = function(type, creator) {
	if (type == "TEXt" && creator == "REAd") {
		return true;
	}
	return false;
}

DocRecord.prototype.loadDefaults = function(isTextData) {
    this.isTextData = isTextData;
    if (isTextData) {
        //Initializing data
        this.data = new Array();
        //We don't know what header to link to yet
        this.headerRecord = null;
    } else {
        //Initializing a doc header
        this.attribute = new Object(); 
        this.attribute.compression = 0;
        this.attribute.textLength = 0;
        this.attribute.recordCount = 0;
        this.attribute.recordSize = 0;
        this.attribute.currReadingPos = 0;
        //A header is its own header
        this.header = this;
    }
}

DocRecord.prototype.parseHeader = function(bytes) {
	if (bytes.length < 16) {
        //This is a hard error!
        console.error(
            "Invalid (too short) DOC header. Is this really a DOC file?"
        );
        return;
    } else if (bytes.length != 16 || bytes[3] == 0 && bytes[4] == 0) {
        //This warrants a warning at worst
        console.warn("Detected an overlong or strange DOC header record." +
            " Is this really a DOC file?"
        );
    }
    this.attribute = new Object();
    //Compression is set in the first two bytes
    this.attribute.compression = concatBytesVar(bytes[0], bytes[1]);
	//Bytes 2 & 3  are unused
    //Text length are the bytes 4-7
    this.attribute.textLength = concatBytesVar(
        bytes[4], bytes[5], bytes[6], bytes[7]
    );
    //Record count is stored in bytes 8 & 9
    this.attribute.recordCount = concatBytesVar(
        bytes[8], bytes[9]
    );
    //Record size is in bytes 10 & 11 and SHOULD always be 4096
    this.attribute.recordSize = concatBytesVar(
        bytes[10], bytes[11]
    );
    //The last four bytes are the current reading position
    this.attribute.currReadingPos = concatBytesVar(
        bytes[12], bytes[13], bytes[14], bytes[15]
    );
    
    //A header is its own header
    this.header = this;
}

DocRecord.prototype.filterMarkup = function(openTags) {
	//Since we deal with HTML, we replace ALL linebreaks with spaces
	for (var i = 0; i < this.data.length; i+=1) {
		var b = this.data[i];
		switch(b) {
			case 0x0A: case 0x0D:
				this.data.splice(i, 1, 0x20);
		}
	}
	
	//Parsing the stream for tags; if openTags are valid, we prepend them
	var html = null;
	if (openTags) {
		html = HTMLParser.parseBytes(openTags.concat(this.data), null);
	} else {
		html = HTMLParser.parseBytes(this.data, null);
	}
	
	var plainInsets = new Array();
	
	//We filter out / replace some tags
	for (var i = 0; i < html.tags.length; i+=1) {
		var tag = html.tags[i];
		switch (tag.name) {
			case "doctype": //Doctype tags are removed
			case "!doctype":
			case "html": 	//The html tag is removed
			case "body": 	//The body tag is removed
			case "div":		//Div tags are removed
			case "font":	//Font tags are removed
			case "a":		//A tags are removed, because they're spammed
			case "blockquote": //Removed since it wastes screen space
			case "pre":		//Preformatting is dropped
			case "table":	//Tables are dropped
			case "col":
				html.tags.splice(i, 1);
				i--;
				break;
			case "tr": //tr's are replaced with a "<br/> tag"
			case "p":  //p tags are replaced with <br/>
				//Closing p's are only br'ed, if there isn't a br close by
				if (i+1 < html.tags.length && tag.closing) {
					var nTag = html.tags[i+1];
					if (nTag.name == "br" && (nTag.position - tag.position < 5)) {
						//We don't replace the tag with a space, because a br follows
						html.tags.splice(i, 1);
						i--;
						break;
					} 
				}
				var spacer = new Tag("br/", tag.position);
				html.tags.splice(i, 1, spacer);
				break;
			case "td": //td's are replaced with spacebar "tag"
				var spacer = new Tag(" ", tag.position, true); 
				html.tags.splice(i, 1, spacer);
				break;
			case "head": 	//The head tag and everything in it is removed
			case "script": 	//Script tags are removed
			case "style": 	//Style tags are removed
				HTMLParser.removeTagAndContent(html, tag.name, i);
				//We removed at least one tag
				i--;
				break;
			case "img": //Img-tags contain a record number
				//<img src="BMP" recindex="00001">
				console.log("DocRecord: Found IMG: " + tag.toString());
				var rec = tag.getAttribute("recindex");
				if (rec == null || isNaN(rec = parseInt(rec.value))) {
					//Invalid img tag, we remove it
					html.tags.splice(i--, 1);
					break;
				}
				//Replacing the content of the tag with a recIndex label
				tag.content = "label=\"" + rec + "\"";
				break;
		}
	}
	
	//Now, if the html parser dropped bytes from the end due to
	//open tags, these must be preserved for the next run
	//console.log("DocRecord dropped " + html.droppedBytes + " bytes");
	if (html.droppedBytes > 0) {
		openTags = this.data.slice(-html.droppedBytes);
	} else {
		//No open (truncated) tags at the end
		openTags = null;
	}
	
	//Now, we replace the data with the filtered one
	this.data = HTMLParser.toRichText(
		html.plainBytes, html.tags, null, null
	);
	return openTags;
}
