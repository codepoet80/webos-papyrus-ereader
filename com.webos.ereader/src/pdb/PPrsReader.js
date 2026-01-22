function PPrsReader(reader, callback, controller) {
    //Storing the parameters
    this.reader = reader;
    this.callback = callback;
	this.controller = controller;
	this.userName = "";
	this.passCode = "";
	//The image index array; Object: {label, record}
	this.images = new Array();
	
    //Setting the new stream from that reader
    if (this.setStream(reader) == false) {
        this.setStreamGiveUp();
    } else {
        //It is a PPrs Doc! Loading is asynchronous, so the callback is called later
    }
}

//A DocReader implements the ByteReader interface
PPrsReader.prototype = new ByteReader();

/**
 * Switches the input stream of the ByteReader to the given object.
 * Depending on the implementing class, inStream can be a filename,
 * an array, a string or whatever the given ByteReader specifies.
 * @param {Object} inStream the new input stream for this reader.
 */
PPrsReader.prototype.setStream = function(inStream) {
    //Checking if the stream is a ByteReader
    if (inStream) { // && inStream.isPrototypeOf(ByteReader)) {
        //Creating the PDBfile from that reader
        this.pdb = new PDBFile(inStream);
        //Now we check if the PDBFile is actually a PPrs Document
        if (PPrsRecord.isValidID(this.pdb.type, this.pdb.creator) == false) {
            //This is not a PPrs format
            return false;
        }
        //The reader seems sound, remembering it
        this.reader = inStream;
        
        //Now, that we've read the necessary headers of the PDB file,
        //we load the first doc header
        var startOffset = this.pdb.records[0].offset;
        var endOffset = this.pdb.records[1].offset;
        var bytes = this.reader.read(startOffset, endOffset - startOffset);
        //With the record in byte form, we create the DocRecord header
        this.header = new PPrsRecord(false, bytes);

		//Creating the variable for the offsets
        this.uncmpOffsets = new Array();
        this.uncmpOffsets[0] = 0;
        
        //Creating the variables for the buffering of the last record
        this.lastRecord = null;
        this.lastRecordNum = -1;
		
		if (this.header.attribute.isDrmEncrypted) {
			bytes = this.pdb.loadRecordBytes(1);
			this.parseSecurityHeader(bytes);
						
			if (this.header.attribute.isDrmVersionSupported) {
				this.showCredentialsDialog();
			} else {
				return false;
			}
		} else {        
			//And calling the callback
			this.setStreamSuccess();
		}
    } else {
        throw("Failed to pass a ByteReader to the PPrsReader class");
    }
    return true;
}

PPrsReader.prototype.setStreamGiveUp = function() {
	this.callback(this.reader, null);
}

PPrsReader.prototype.setStreamSuccess = function() {
	//Before we return a success, we must index the images
	this.indexImageRecords();
}

PPrsReader.prototype.showCredentialsDialog = function() {
	if (this.controller) {
		this.controller.showDialog({
			template: 'Library/Credentials-dialog',
			assistant: new CredentialsDialogAssistant(
							this, 
							this.validateCredentials.bind(this),
							this.setStreamGiveUp.bind(this)
					   ),
			preventCancel: true
		});
	}
	else {
		this.setStreamGiveUp();
	}
}

/**
 * For a PPrs file with DRM, validates user credentials before
 * attempting to decrypt.  On successful validation, the book's
 * des contentKey is stored in the header.attribute. 
 * @param {String} userName the full name of the owner of the book.
 * @param {String} passCode the numeric code assigned by the publisher
 *                 which is required to decrypt a protected book.
 */
PPrsReader.prototype.validateCredentials = function(userName, passCode, fromKeyring, passDB) {
	console.log("validateCredentials: " + userName + ", " + passCode);
	var result = false;
	var contentKey;
	
	// save for later possible correction when
	// the dialog is shown again.
	this.userName = userName;
	this.passCode = passCode;
	
	if (userName && passCode) {	
		// strip all characters other than alphanum
		userName = userName.toLowerCase().replace(/[^a-z0-9]/g,"");
		passCode = passCode.toLowerCase().replace(/[^a-z0-9]/g,"");
		
		if (passCode.length >= 8 && userName.length > 0) {
			// compute crc32
			var n = crc32(userName);
			var c = crc32(passCode.substr(passCode.length-8,8));
			n = (n < 0) ? (0xffffffff + n + 1) : n; //handle javascript's sign bit
			c = (c < 0) ? (0xffffffff + c + 1) : c; //handle javascript's sign bit
			// user key is 8 bytes of 2 crc32 results
			var userkey = splitU32(n).concat(splitU32(c));
			// decrypt book content key using userkey, store in header.attribute
			contentKey = des(
				this.rotateBits(userkey), this.header.attribute.encryptedContentKey
			);
			// valid credentials supplied if sha1 hashes match
			result = ( bytesToHex(this.header.attribute.encryptedContentKeySha)
					   == sha1(bytesToString(contentKey))
		   );
		}
	}

	if(result) {
		// valid credentials, content key stored in header.attribute
		this.header.attribute.contentKey = this.rotateBits(contentKey);
		//Now, we check if the pw can be added to the Keyring DB
		if (!fromKeyring) {
			//Asking whether to add to the password DB
			PasswordDB.askAddData(
				this.controller, passDB, PasswordDB.TYPE_CREDENTIAL,
				this.userName, this.passCode,
				this.setStreamSuccess.bind(this)
			);
		} else {
			//Not a new password
			this.setStreamSuccess();
		}
		//We mark the stream as being opened successfully
		//this.setStreamSuccess();
		//Now that we've got the content key, we can drop username and passCode
		this.userName = null;
		this.passCode = null;
	} else {
		// invalid input, display notice, ask again for credentials
		var msgDef = "The Name or Pass Code do not match those required to open the book." +
			" Hint: If your Pass Code is your Credit Card number, try entering only the last 8 characters.";
		var msg = $L({
			value: msgDef, key: "PassCodeInvalidMsg"
		});
		if (this.controller) {
			this.controller.showAlertDialog( {
				onChoose: this.showCredentialsDialog.bind(this),
				title: $L("Invalid Name or Pass Code"),
				message: msg,
				choices: [{
					label: $L('Okay'),
					value: "okay",
					type: 'affirmative'
				}]
			});
		}
	}
}

/**
 * Parses the bytes of a PPrs doc security header which is stored at the
 * end of the second pdb record.  Relevant security info is then stored
 * in header.attribute.  If the version of DRM discovered is found to be
 * not supported the attribute isDrmVersionSupported is set to false and
 * security parsing is aborted early, possibly with incomplete information.
 * @param (Byte Array) the bytes of the second record (record number 1) 
 *		  as an array of integers
 */
PPrsReader.prototype.parseSecurityHeader = function(bytes) {
	var ha = this.header.attribute;
	
	if (!ha.isDrmVersionSupported) return;

	// des decryption key is first 8 bytes (rotated)
	var simpleDesKey = this.rotateBits(bytes.slice(0,8));
	// encrypted security block parameters are in last 8 bytes of pdb record
	var secParms = des(simpleDesKey, bytes.slice(bytes.length-8,bytes.length));	
	var byteRotationSize = concatBytes(secParms.slice(0,4));
	var securityBlockSize = concatBytes(secParms.slice(4,8));

	// validate security header information
	ha.isDrmVersionSupported = (
		byteRotationSize >= 3
		&& byteRotationSize <= 20
		&& securityBlockSize >= 240
		&& securityBlockSize <= 512
	);
	
	if (!ha.isDrmVersionSupported) return;
	
	var securityBlock = des(
        simpleDesKey, 
        bytes.slice(
            bytes.length-securityBlockSize,
            bytes.length
        )
    );	
	securityBlock = this.rotateBytes(
        securityBlock.slice(
            0,
            securityBlock.length-8
        ),
        byteRotationSize
    );

	// validate drm version information
	drmVersion = concatBytes(securityBlock.slice(0,2));
	drmFlags = concatBytes(securityBlock.slice(4,8));

	ha.isDrmVersionSupported = (
		(drmFlags & 1664) == 1664
		&& ( (ha.compression == 259 && drmVersion == 7)  || (ha.compression != 259) )
		&& ( (ha.compression == 260 && drmVersion == 13) || (ha.compression != 260) )
	);
		
	if (!ha.isDrmVersionSupported) return;

	// set book parameters in header attribute
	ha.nonTextRecordStart = concatBytes(securityBlock.slice(2,4));
	ha.startImagePage = concatBytes(securityBlock.slice(24,26));
	ha.totalImagePages = concatBytes(securityBlock.slice(26,28));
	
	if (ha.compression == 259) {
		ha.encryptedContentKey = securityBlock.slice(64,64+8);
		ha.encryptedContentKeySha = securityBlock.slice(44,44+20); 
	} else if (ha.compression == 260) {
		ha.encryptedContentKey = securityBlock.slice(44,44+8);
		ha.encryptedContentKeySha = securityBlock.slice(52,52+20); 
	} else if (ha.compression == 272) {
		ha.encryptedContentKey = securityBlock.slice(172,172+8);
		ha.encryptedContentKeySha = securityBlock.slice(56,56+20);
	}
}

/**
 * basic byte manipulation routine for decryption.
 * @a (Byte Array)
 * @rotationSize (int) the size of the byte chunks to rotate
 */
PPrsReader.prototype.rotateBytes = function(a,rotationSize) {
	var f=[];
	var c = 0;
	for(var i=0;i<a.length;i++) {
		c = (c+rotationSize)%a.length;
		f[c] = a[i];		
	}
	return f;
}

/**
 * basic bit manipulation routine for decryption.
 * @a (Byte Array)
 */
PPrsReader.prototype.rotateBits = function(a) {
	for(var i = 0; i < a.length; i++) {
		a[i] = a[i] ^ ( (
			a[i]
			^ ( a[i] << 1 )
			^ ( a[i] << 2 )
			^ ( a[i] << 3 )
			^ ( a[i] << 4 )
			^ ( a[i] << 5 )
			^ ( a[i] << 6 )
			^ ( a[i] << 7 )
			^ 0x80 
		) & 0x80 );
	}
	return a;
}

PPrsReader.prototype.loadRecord = function(num) {
    if (this.lastRecordNum == num) {
        //We've already buffered the record, returning it
        return this.lastRecord;
    }
    var bytes = this.pdb.loadRecordBytes(num);
    if (bytes && bytes != null) {
		var openTags = (this.lastRecord != null)
			? this.lastRecord.openTags : null;
		//console.log("OpenTags = " + ((openTags != null) ? openTags.length : 0));
        record = new PPrsRecord(true, bytes, this.header, openTags);
        //Buffering this record
        this.lastRecord = record;
        this.lastRecordNum = num;
        if (this.uncmpOffsets.length <= num) {
            //Storing the new offset
            this.uncmpOffsets[num] = this.uncmpOffsets[num - 1] +
                    this.lastRecord.data.length;
        }
        //And returning it
        return record;
    } else {
        return null;
    }
}

/**
 * This method reads 'len' bytes from the PPrs file.
 *
 * @param {Number} start the position of the byte that should be read.
 * @param {Number} len the number of bytes that should be read.
 *         If len is not specified 1 should be assumed.
 */
PPrsReader.prototype.read = function(start, len) {
    //console.log("Will read " + len + " bytes @ " + start)
    //Checking if len was assigned
    if (!len) len = 1;
    //Sanitizing start and len
    start = Math.floor(start);
    len = Math.floor(len);
    
    //Now we load the data of the records till we've completely filled the buffer
    var buf = new Array();
    var bytePos = start;
    while (buf.length < len) {
        //We use the uncmpOffsets to find the correct record
        var num = this.getRecordNumForByte(start + buf.length);
        if (num <= 0 || num >= this.header.attribute.nonTextRecordStart) {
            //No such record; probably EOF, returning what's in the buffer
            return buf;
        }
        //Loading that record
        var record = this.loadRecord(num);
        //Checking if record was loaded
        if (!record || record == null) {
            //Couldn't load the record, that's bad
            console.warn("Couldn't load PPrsRecord number " + num);
            return buf;
        }
        
        //Now, we can fetch data from the record
        var pos = start + buf.length - this.uncmpOffsets[num-1];
        while(buf.length < len && pos < record.data.length) {
            //TODO: It might be possible that some record entries are invalid.
            //In this case, test for existence of record.data
            buf.push(record.data[pos]);
            pos += 1;
        }
    }
    //Now, we can return the buffer
    return buf;
}

/**
 * Returns whether or not this byteReader's read() function
 * is asynchronous or synchronous. In other words, if this
 * function returns true, the read() function returns immediately
 * and will actually call the callback function when the data
 * arrives. 
 */
PPrsReader.prototype.readIsAsync = function() {
    return false;
}

PPrsReader.prototype.getRecordNumForByte = function(start) {
    for (var i = 0; i < this.uncmpOffsets.length - 1; i++) {
        if (this.uncmpOffsets[i] <= start && this.uncmpOffsets[i+1] > start) {
            return i + 1;
        }
    }
    //We return the last record
    return i + 1;
}

/**
 * Without reading the entire file, the uncompressed size of a PPRs can't
 * be determined. As such, we estimate the length; usually each text record
 * contains roughly 8000 bytes, if ZLib compressed. If PalmDOC or uncompressed,
 * it should be 4096 bytes.
 */
PPrsReader.prototype.getLength = function() {
	var textRecNum = this.header.attribute.nonTextRecordStart - 1;
	if (this.header.attribute.isDrmEncrypted ||
			this.header.attribute.isZlibCompressed) {
		//console.log("Assuming ZLib = " + textRecNum);
		return textRecNum * 8000;
	} else {
		//console.log("Assuming PalmDOC/Uncmp = " + textRecNum);
		return textRecNum * 4096;
	}
}

/**
 * Closes the input stream.
 */
PPrsReader.prototype.close = function() {
    //Does nothing yet
}


PPrsReader.prototype.indexImageRecords = function(count) {
	//console.log("indexImageRecords; count = " + count);
	if (typeof(count) == "undefined" || count == null) {
		count = 0;
	}
	//Checking if we're in panic mode (if the pdb header and eReader
	//attributes just don't add up. In that case, we must use a linear search
	if (this.header.attribute.imageRecordStart > this.pdb.numRecords) {
		//PANIC MODE!!! The eReader header is insane. Using greedy search for IMGs
		//console.warn("Using PANIC MODE for image indexing")
		var currRec = count + this.header.attribute.nonTextRecordStart;
	} else {
		//The eReader header is sane, we can use its details
		var currRec = count + this.header.attribute.imageRecordStart;
	}
	
	//Checking if we've indexed enough images
	if (currRec >= this.pdb.numRecords ||
			this.images.length >= this.header.attribute.numImages) {
		console.log("Parsed all image records");
		//We've parsed all images; we report a loading success
		this.callback(this.reader, this);
		return;
	}
	//Otherwise, we read the record, check if it's an image,
	//index it and call ourselves; we don't load the whole record, though
	var bytes = this.pdb.loadRecordBytes(currRec, 128);
	//Checking if the record fulfills a certain minimum size
	if (bytes.length < 62) {
		//console.warn("Examined record is too short for an image record.");
		//Calling the next record; deferred
		this.indexImageRecords.bind(this, count+1).defer();
		return;
	}
	//Checking if that record starts with the magic "PNG " string
	var text = bytesToString(bytes.slice(0,4));
	if (text != "PNG ") {
		//console.warn("Record is not a PNG image.");
		//Not an image record, skipping to the next record
		this.indexImageRecords.bind(this, count+1).defer();
		return;
	}
	//Now we know that it's an image. Parsing the name
	var name = ""
	for (var i = 4; i < 36; i+=1) {
		var chr = bytes[i];
		//Checking for end of name
		if (chr == 0x00) { break; }
		//Otherwise, we append
		name += String.fromCharCode(chr);
	}
	//Now, if the name's okay, we add it to the image index
	this.images.push({
		label: name,
		record: currRec		
	});
	//And we call the next record, deferred
	this.indexImageRecords.bind(this, count+1).defer();
}

PPrsReader.prototype.getImage = function(label) {
	console.log("PPrsReader: Fetching image " + label);
	//Sanity check
	if (typeof(label) == "undefined" || label == null) {
		return null;
	}
	//We check if the label's one of the indexed images
	var recNum = -1;
	for (var i = 0; i < this.images.length; i+=1) {
		var index = this.images[i];
		if (index.label == label) {
			recNum = index.record
			break;
		}
	}
	//Checking the record number
	if (isNaN(recNum) || recNum <= 0) { return null; }
	//Sanity checking that record number
	if (recNum >= this.pdb.numRecords) { return null; }
	//Now we can load the byte data of the image
	var bytes = this.pdb.loadRecordBytes(recNum);
	//Sanity checking the bytes
	if (!bytes || bytes == null) { return null; }
	//We must slice off the first 61 bytes
	return bytes.slice(62);
}