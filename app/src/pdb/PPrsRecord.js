/**
 * Parses the bytes of a PPrs doc record and decompresses them if necessary.
 * @param isTextData whether or not this is the first header record, or one of
 *        the further text records.
 * @param bytes the bytes of the target record as an array of in_tegers
 * @param headerRecord, a link back to the header, if it's a text record.
 */
function PPrsRecord(isTextData, bytes, headerRecord, openTags) {
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
        if (headerRecord.attribute.isLZ77Compressed) {
			//Using Legacy Palm-DOC LZ77 decompression 
            this.data = new Lz77().decompress(bytes);
        } else if (headerRecord.attribute.isZlibCompressed) {
			//Compressed Data needs to be separately decoded
			this.data = new Zlib().decompress(bytes);
		} else if (headerRecord.attribute.isDrmVersionSupported) {
			//DRM uses des encrypted zlib-compressed data
			this.data = new Zlib().decompress(des(headerRecord.attribute.contentKey,bytes));
        } else {
            //We assume uncompressed Data
            this.data = bytes;
        }
		//Now, we need to clean the data of all markup
		this.openTags = this.filterMarkup(openTags);
    } else {
        this.parseHeader(bytes);
    }
}

PPrsRecord.isValidID = function(type, creator) {
	if (type == "PNRd" && creator == "PPrs") {
		return true;
	} else if (creator == "PPrs" && (type == "Data" || type == "PDct")) {
		return true;
	}
	return false;
}

PPrsRecord.prototype.loadDefaults = function(isTextData) {
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
        this.attribute.nonTextRecordStart = 0;
        //A header is its own header
        this.header = this;
    }
}

PPrsRecord.prototype.parseHeader = function(bytes) {
    this.attribute = new Object();
    //Compression is set in the first two bytes
    this.attribute.compression = concatBytesVar(
		bytes[0], bytes[1]
	);
    //Bytes 12&13 encode the Non-Text record start
    this.attribute.nonTextRecordStart = concatBytesVar(
        bytes[12], bytes[13]
	);
	
	//Bytes 20&21 encode the number of images records
    this.attribute.numImages = concatBytesVar(
        bytes[20], bytes[21]
	);
	//Checking if that is > 0
	this.attribute.imageRecordStart = 0;
	if (this.attribute.numImages > 0) {
		//Fetching the start of the image records
		this.attribute.imageRecordStart = concatBytesVar(
	        bytes[40], bytes[41]
		);		
	}

	this.attribute.isZlibCompressed = (this.attribute.compression == 10);
	this.attribute.isLZ77Compressed = (this.attribute.compression == 2);
	this.attribute.isDrmEncrypted = (
		this.attribute.compression == 259
		|| this.attribute.compression == 260
		|| this.attribute.compression == 272
		|| this.attribute.compression == 138
	);
	this.attribute.isDrmVersionSupported = (
		this.attribute.compression == 259
		|| this.attribute.compression == 260
		|| this.attribute.compression == 272
	);
	
    //A header is its own header
    this.header = this;
}

PPrsRecord.prototype.filterMarkup = function(openTags) {
	if (!this.data || this.data.length == 0) {
		return;
	}
	var useOT = typeof(openTags) != "undefined" &&
			openTags != null && openTags.length > 0;
	//Special states
	var inSd = (useOT && openTags.indexOf("Sd") >= 0) ? true : false;
	var inFn = (useOT && openTags.indexOf("Fn") >= 0) ? true : false;
	var inq = (useOT && openTags.indexOf("q") >= 0) ? true : false;
	var inI = (useOT && openTags.indexOf("I") >= 0) ? true : false;
	var inB = (useOT && openTags.indexOf("B") >= 0) ? true : false;
	var inb = (useOT && openTags.indexOf("b") >= 0) ? true : false;
	var inc = (useOT && openTags.indexOf("c") >= 0) ? true : false;
	var ino = (useOT && openTags.indexOf("o") >= 0) ? true : false;
	var ink = (useOT && openTags.indexOf("k") >= 0) ? true : false;
	var inr = (useOT && openTags.indexOf("r") >= 0) ? true : false;
	var inU = (useOT && openTags.indexOf("U") >= 0) ? true : false;
	var in_t = (useOT && openTags.indexOf("t") >= 0) ? true : false;
	var inL = (useOT && openTags.indexOf("L") >= 0) ? true : false;
	var inSb = (useOT && openTags.indexOf("Sb") >= 0) ? true : false;
	var inSp = (useOT && openTags.indexOf("Sp") >= 0) ? true : false;
	var inXn = (useOT && openTags.indexOf("Xn") >= 0) ? true : false;
	
	//Checking if we have skipped chars in the openTags array
	var sFlag = (useOT && openTags.indexOf("skipFlag") >= 0) ? true : false;
	var sChars = "";
	if (sFlag) {
		//The last entry of openTags should contain the skipped chars in hex code
		sChars = openTags.last();
		if (sChars.startsWith("skipChars")) {
			sChars = sChars.slice(9);
			sChars = hexToBytes(sChars);
			//Prepending the extra chars
			concatArray(sChars, this.data);
			this.data = sChars;
			sChars = null;
		}
	}
	sFlag = false;
	
	var spaceCnt = -1;
	
	var byteBuf = new Array();
	state = 0;
	for (var i = 0; i < this.data.length; i++) {
		var chr = this.data[i];
		switch (state) {
			case 0: //Normal state in which we look for markup
				//Checking if we encountered a newline plus four spaces
				if (chr == 0x20 && spaceCnt >= 0) {
					spaceCnt++;
					if (spaceCnt >= 4) {
						console.log("Added special indent-sequence.")
						//Slicing off the spaces (one has not yet been added)
						// and adding the special <&indent;/> tags
						byteBuf.splice(byteBuf.length - 3, 3);
						var indent = [0x3C, 0x26, 0x69, 0x6E, 0x64, 0x65, 0x6E, 0x74, 0x3B, 0x2F, 0x3E];
						concatArray(byteBuf, indent);
						spaceCnt = -1;
						//And we continue the loop with the next char
						continue;
					}
				} else {
					spaceCnt = -1;
				}
				switch (chr) {
					case 0x5C:
						//A backslash might start markup that needs to be removed
						state += 1;
						break;
					case 0x3E: //A ">" is replaced with &gt;
						byteBuf.push(0x26, 0x67, 0x74, 0x3B);
						break;
					case 0x3C: //A "<" is replaced with &lt;
						byteBuf.push(0x26, 0x6C, 0x74, 0x3B);
						break;
					case 0x0A: case 0x0D:
						//We must add a line break <br/>
						byteBuf.push(0x3C, 0x62, 0x72, 0x2F, 0x3E);
						//We can begin searching for four spaces
						spaceCnt = 0;
						//TODO: The official eReader app seems to also indent the first
						//text line after a newline. But what happens to \t tags?
						break;
					default:
						byteBuf.push(chr);
						break;
				}
				break;
			case 1: //Checking if it's an escaped slash and what kind of markup it is
				switch (chr) {
					case 0x5C:
						//It is an escaped backslash, copying a single backslash to the byteBuf
						byteBuf.push(chr);
						state = 0;
						break;
					case 0x69: //i - italicize; is translated to <i> or </i>
						if (inI == true) {
							byteBuf.push(0x3C, 0x2F, 0x69, 0x3E);
							inI = false;
						} else {
							byteBuf.push(0x3C, 0x69, 0x3E);
							inI = true;
						}
						state = 0;
						break;
					case 0x62: //b - bold; is translated to <b> or </b>
						if (inb == true) {
							byteBuf.push(0x3C, 0x2F, 0x62, 0x3E);
							inb = false;
						} else {
							byteBuf.push(0x3C, 0x62, 0x3E);
							inb = true;
						}
						state = 0;
						break;
					case 0x42: //B - bold; is translated to <b> or </b>
						if (inB == true) {
							byteBuf.push(0x3C, 0x2F, 0x62, 0x3E);
							inB = false;
						} else {
							byteBuf.push(0x3C, 0x62, 0x3E);
							inB = true;
						}
						state = 0;
						break;
					case 0x63: //c - center; is translated to \n<div style="text-align:center;"> or </div>
						if (inc == true) {
							byteBuf.push(0x3C, 0x2F, 0x64, 0x69, 0x76, 0x3E);
							inc = false;
						} else {
							byteBuf.push(0x3C, 0x64, 0x69, 0x76, 0x20, 0x73, 0x74, 0x79, 0x6C, 0x65,
										 0x3D, 0x22, 0x74, 0x65, 0x78, 0x74, 0x2D, 0x61, 0x6C, 0x69,
										 0x67, 0x6E, 0x3A, 0x63, 0x65, 0x6E, 0x74, 0x65, 0x72, 0x3B,
										 0x22, 0x3E);
							inc = true;
						}
						state = 0;
						break;
					case 0x6B: //k - smallcaps; is translated to <span style="font-variant:small-caps;"> or </span>
						if (ink == true) {
							byteBuf.push(0x3C, 0x2F, 0x73, 0x70, 0x61, 0x6E, 0x3E);
							ink = false;
						} else {
							byteBuf.push(0x3C, 0x73, 0x70, 0x61, 0x6E, 0x20, 0x73, 0x74, 0x79, 0x6C,
										 0x65, 0x3D, 0x22, 0x66, 0x6F, 0x6E, 0x74, 0x2D, 0x76, 0x61,
										 0x72, 0x69, 0x61, 0x6E, 0x74, 0x3A, 0x73, 0x6D, 0x61, 0x6C,
										 0x6C, 0x2D, 0x63, 0x61, 0x70, 0x73, 0x3B, 0x22, 0x3E);
							ink = true;
						}
					case 0x70: //p - pagebreak not sure how to handle this one, just skip for now
						state = 0;
						break;
					case 0x72: //r - right; is translated to \n<div style="text-align:right;"> or </div>
						if (inr == true) {
							byteBuf.push(0x3C, 0x2F, 0x64, 0x69, 0x76, 0x3E);
							inr = false;
						} else {
							byteBuf.push(0x3C, 0x64, 0x69, 0x76, 0x20, 0x73, 0x74, 0x79, 0x6C, 0x65,
										 0x3D, 0x22, 0x74, 0x65, 0x78, 0x74, 0x2D, 0x61, 0x6C, 0x69,
										 0x67, 0x6E, 0x3A, 0x72, 0x69, 0x67, 0x68, 0x74, 0x3B, 0x22,
										 0x3E);
							inr = true;
						}
						state = 0;
						break;
					case 0x6F: //o - overstrike; is translated to <del> or </del>
						if (ino == true) {
							byteBuf.push(0x3C, 0x2F, 0x64, 0x65, 0x6C, 0x3E);
							ino = false;
						} else {
							byteBuf.push(0x3C, 0x64, 0x65, 0x6C, 0x3E);
							ino = true;
						}
						state = 0;
						break;	
					case 0x74: //t indent; is translated to <div style="margin-left:8%;"> or </div>
						if (in_t == true) {
							byteBuf.push(0x3C, 0x2F, 0x64, 0x69, 0x76, 0x3E);
							in_t = false;
						} else {
							//Checking if we can execute a lookahead
							if (i+2 >= this.data.length) {
								//No, that means we pass those bytes to the next record
								sFlag = true;
								sChars = this.data.slice(i-1);
								i = this.data.length;
								continue;
							}
							if (this.data[i+2]==0x5C && this.data[i+3]==0x74) { // single line indent = <br/><&indent;/>
								//Checking if the char between the \t's is printable
								if (this.data[i+1] != 0x20 && this.data[i+1] != 0x0A) {
									byteBuf.push(0x3C, 0x62, 0x72, 0x2F, 0x3E);
									byteBuf.push(0x3C, 0x26, 0x69, 0x6E, 0x64, 0x65, 0x6E, 0x74, 0x3B, 0x2F, 0x3E);
								}
								//After that, we need to put in the skipped in-between char
								byteBuf.push(this.data[i+1]);
								i += 3;
							} else { //multi line indent
								byteBuf.push(0x3C, 0x64, 0x69, 0x76, 0x20, 0x73, 0x74, 0x79, 0x6C, 0x65,
											 0x3D, 0x22, 0x6D, 0x61, 0x72, 0x67, 0x69, 0x6E, 0x2D, 0x6C,
											 0x65, 0x66, 0x74, 0x3A, 0x38, 0x25, 0x3B, 0x22, 0x3E);
								in_t = true;
							}
						}
						state = 0;
						break;						
					case 0x75: //u - underline; is translated to <u> or </u>
						if (inU == true) {
							byteBuf.push(0x3C, 0x2F, 0x75, 0x3E);
							inU = false;
						} else {
							byteBuf.push(0x3C, 0x75, 0x3E);
							inU = true;
						}
						state = 0;
						break;
					case 0x6C: //l - large; is translated to <big> or </big>
						if (inL == true) {
							byteBuf.push(0x3C, 0x2F, 0x62, 0x69, 0x67, 0x3E);
							inL = false;
						} else {
							byteBuf.push(0x3C, 0x62, 0x69, 0x67, 0x3E);
							inL = true;
						}
						state = 0;
						break;
					case 0x2D: //Soft hyphen -- it is not replaced by a space
						state = 0;
						break;
					case 0x61: //aXXX is an escape for a non-ASCII CP-1252 sign.
						var number = [
							this.data[i+1], this.data[i+2], this.data[i+3]
						]
						number = parseInt(bytesToString(number), 10);
						//Pushing that number
						byteBuf.push(number);
						//And marking that we skipped characters
						i += 3;
						state = 0;
						break;
					case 0x55: //UXXXX is an escape for Unicode
						var number = [
							this.data[i+1], this.data[i+2], this.data[i+3], this.data[i+4] 
						]
						number = parseInt(bytesToString(number), 16);
						//Pushing that number in several bytes
						if (number >= 0 && number <= 0xFF) {
							byteBuf.push(number);
						} else {
							for (var shift = 24; shift >= 0; shift -= 8) {
								var num = (number >> shift) & 0xFF;
								if (num > 0 || shift == 0) {
									byteBuf.push(num);
								}
							}							
						}
						//And marking that we skipped characters
						i += 4;
						state = 0;
						break;
					case 0x6D: //m command, creates a <img label=""></img> tag
						//We find the end of the label element
						var quoteEnd = this.skipQuotedMarkup(i);
						var label = this.data.slice(i+3, quoteEnd);
						//Adding (<img label=")
						byteBuf.push(
							0x3C, 0x69, 0x6D, 0x67, 0x20, 0x6C,
							0x61, 0x62, 0x65, 0x6C, 0x3D, 0x22
						)
						//Adding the label
						concatArray(byteBuf,label);
						//Adding ("></img>)
						byteBuf.push(0x22, 0x3E, 0x3C, 0x2F, 0x69, 0x6D, 0x67, 0x3E);
						//Setting i to the quote end
						i = quoteEnd;
						//And at last, we change state
						state = 0;
						break;
					case 0x51: //Q command, creates a <a name=""></a> tag
						//We find the end of the label element
						var quoteEnd = this.skipQuotedMarkup(i);
						var label = this.data.slice(i+3, quoteEnd);
						//Adding (<a name=")
						byteBuf.push(
							0x3C, 0x61, 0x20, 0x6E, 0x61, 0x6D, 0x65, 0x3D, 0x22
						)
						//Adding the label
						concatArray(byteBuf,label);
						//Adding ("></a>)
						byteBuf.push(0x22, 0x3E, 0x3C, 0x2F, 0x61, 0x3E);
						//Setting i to the quote end
						i = quoteEnd;
						//And at last, we change state
						state = 0;
						break;
					case 0x71: //q a link to a Q anchor, creates <a href="#xzy"></a> tag
						if (inq == true) {
							//We close a link with </a>
							byteBuf.push(0x3C, 0x2F, 0x61, 0x3E);
							inq = false;
						} else {
							//We find the end of the label element
							var quoteEnd = this.skipQuotedMarkup(i);
							var label = this.data.slice(i+3, quoteEnd);
							//Adding (<a href="); the # is part of q's label
							byteBuf.push(
								0x3C, 0x61, 0x20, 0x68, 0x72, 0x65, 0x66, 0x3D, 0x22
							);
							//Adding the label
							concatArray(byteBuf,label);
							//Adding (">)
							byteBuf.push(0x22, 0x3E);
							//Setting i to the quote end
							i = quoteEnd;
							inq = true;
						}
						//And at last, we change state
						state = 0;
						break;
					case 0x43: //Cn command, ignore all chars till you've read two quotes (0x22)
					case 0x54: //T command, the same
					case 0x77: //w command, the same
						i = this.skipQuotedMarkup(i);
						if (chr == 0x77) {
							//A \w necessitates two line breaks
							byteBuf.push(0x0A, 0x0A);
						}
						state = 0;
						break;
					case 0x53: //S command, might be short Sp/Sb or long enclosing Sd
						state = 2;
						break; 
					case 0x46: //Fn long enclosing command
						state = 3;
						break;
					case 0x76: //v long enclosing command (book metadata)
						state = 5;
						break;
					case 0x78: //x Chapter indent level 0
						// backup to x
						i-=1;
						// fall through to Xn parser
					case 0x58: //Xn command, chapter indent level 0-4
						state = 6;
						break;
					default:
						//Catch-all for all the other single line commands
						state = 0;
						break;
				}
				break;
			case 2: //S command special parser
				switch (chr) {
					case 0x62: //Sb - subscript; is translated to <sub> or </sub>
						if (inSb == true) {
							byteBuf.push(0x3C, 0x2F, 0x73, 0x75, 0x62, 0x3E);
							inSb = false;
						} else {
							byteBuf.push(0x3C, 0x73, 0x75, 0x62, 0x3E);
							inSb = true;
						}
						state = 0;
						break;
					case 0x70: //Sp - superscript; is translated to <sup> or </sup>
						if (inSp == true) {
							byteBuf.push(0x3C, 0x2F, 0x73, 0x75, 0x70, 0x3E);
							inSp = false;
						} else {
							byteBuf.push(0x3C, 0x73, 0x75, 0x70, 0x3E);
							inSp = true;
						}
						state = 0;
						break;
					case 0x64: //d, is a long-form enclosing command
						if (inSd == false) {
							//We parsed the start of an Sd, removing quoted chars
							i = this.skipQuotedMarkup(i);
							//And setting inSd state
							inSd = true;
						} else {
							//A closing Sd, we can immediately return to state 0
							inSd = false;
						}
						state = 0;
						break;
				}
				break;
			case 3: //Fn command special parser
				if (inFn == false) {
					//We parsed the start of an Fn, removing quoted chars
					i = this.skipQuotedMarkup(i);
					//An Fn is a footnote, adding a "["
					byteBuf.push(0x5B);
					//And setting inSd state
					inFn = true;
				} else {
					//A closing Fn, we can immediately return to state 0
					inFn = false;
					//A closing Fn is a footnote, adding a "]"
					byteBuf.push(0x5D);
				}
				state = 0;
				break;
			case 5: //v command special parser
					// book metadata information (author, title, eisbn, pub, copyright)
				switch (chr) {
					case 0x5C:
						// lookahead -- check for ending v tag
						if (this.data[i+1] == 0x76) {
							i++;
							// back to initial state
							state = 0;
						}
						break;
					default:
					/** 
					 * book metadata should not be displayed on the page, rather should 
					 * be parsed here and added to HTMLBook to be displayed in an info function.
					 * todo: parse and set information where?
					 */
						break;
				}
				break;		
			case 6: //X command special parser
				switch (chr) {
					case 0x78: //x (equivalent to X0) 
					case 0x30: //X0 
					case 0x31: //X1 
					case 0x32: //X2 
					case 0x33: //X3 
					case 0x34: //X4 
						// todo build chapter index
						state = 0;
						break;
				}
				break;
		}
	}
	//Now we replace the original data with the cleaned byteBuf
	this.data = byteBuf;
	//console.log(bytesToString(this.data));
	//Now, we prepare the openTags array
	var newOpenTags = new Array();
	if (inSd) newOpenTags.push("Sd");
	if (inFn) newOpenTags.push("Fn");
	if (inq) newOpenTags.push("q");
	if (inI) newOpenTags.push("I");
	if (inB) newOpenTags.push("B");
	if (inb) newOpenTags.push("b");
	if (inc) newOpenTags.push("c");
	if (ino) newOpenTags.push("o");
	if (ink) newOpenTags.push("k");
	if (inr) newOpenTags.push("r");
	if (inU) newOpenTags.push("U");
	if (in_t) newOpenTags.push("t");
	if (inL) newOpenTags.push("L");
	if (inSb) newOpenTags.push("Sb");
	if (inSp) newOpenTags.push("Sp");
	if (inXn) newOpenTags.push("Xn");
	
	//Checking whether chars were skipped
	if (sFlag && sChars.length > 0) {
		console.log("Will pass skipped chars to next record.");
		newOpenTags.push("skipFlag");
		newOpenTags.push("skipChars" + bytesToHex(sChars));
	}
	
	return newOpenTags;
}

PPrsRecord.prototype.skipQuotedMarkup = function(i) {
	var qCnt = 0;
	while (qCnt < 2 && i < this.data.length) {
		if (this.data[i] == 0x22) { qCnt += 1; }
		if (qCnt >= 2) break;
		i += 1;
	}
	return i;
}
