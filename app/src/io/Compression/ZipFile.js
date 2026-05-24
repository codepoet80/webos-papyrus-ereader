
function ZipFile(file) {
    this.file = file;
    this.error = 0;
    //Parsing the end of directory to get the position of the directory
    this.parseEndOfDirectory();
    if (this.error != 0) { return; }
    //Parsing the directory, to get details about the files
    this.parseDirectory();
    if (this.error != 0) { return; }
}

// ~~~ The error states ~~~
ZipFile.NO_DIRECTORY          = -1;
ZipFile.DIRECTORY_INVALID     = -2;
ZipFile.DIR_ENTRY_TOO_SHORT   = -3;
ZipFile.DIR_ENTRY_NO_MAGIC    = -4;
ZipFile.FILE_HEADER_TOO_SHORT = -5;
ZipFile.FILE_HEADER_NO_MAGIC  = -6;
ZipFile.FILE_DATA_TOO_SHORT   = -7;
ZipFile.COMPRESSION_INVALID   = -8;
ZipFile.NO_SUCH_FILE          = -9;


ZipFile.prototype.parseEndOfDirectory = function() {
    //Creating the eod defaults
    this.eod = {
        diskNum: 0,     //Number of this disk
        dirStart: 0,    //Disk where central directory starts
        dirRecords: 0,  //Number of central directory records on this disk
        dirRecNum: 0,   //Total number of central directory records
        dirSize: 0,     //Size of central directory (bytes)
        dirOffset: 0,   //Offset of start of central directory, relative to start of archive
        comment: null      //ZIP file comment length (n)
    }
    //We go backwards through the file till we find the dir record
    var dirMagic = [0x50, 0x4B, 0x05, 0x06];
    var dirStart = this.scanBackwardForMagic(dirMagic, this.file.getLength() - 1);
    if (dirStart <= 0) {
        this.error = ZipFile.NO_DIRECTORY;
        return;
    }
    //Now, we fetch the first, static part of the directory
    var bytes = this.file.read(dirStart, 22);
    if (bytes == null || bytes.length < 22) {
        this.error = ZipFile.DIRECTORY_INVALID;
        return;
    }
    //We assign the various fields, they are stored little-endian
    this.eod.diskNum = concatBytesVar(bytes[5], bytes[4]);
    this.eod.dirStart = concatBytesVar(bytes[7], bytes[6]);
    this.eod.dirRecords = concatBytesVar(bytes[9], bytes[8]);
    this.eod.dirRecNum = concatBytesVar(bytes[11], bytes[10]);
    this.eod.dirSize = concatBytesVar(bytes[15], bytes[14], bytes[13], bytes[12]);
    this.eod.dirOffset = concatBytesVar(bytes[19], bytes[18], bytes[17], bytes[16]);
    commentLength = concatBytesVar(bytes[21], bytes[20]);
    //Reading the comment
    var bytes = this.file.read(dirStart+22, commentLength);
    if (bytes != null && bytes.length > 0) {
        //We must reverse the bytes, due to little endian mode
        bytes.reverse();
        this.eod.comment = stringToBytes(bytes);
    }
}

ZipFile.prototype.parseDirectory = function() {
    //Creating the central directory array
    this.directory = new Array();
    //Fetching the entire central directory byte stream
    var bytes = this.file.read(this.eod.dirOffset, this.eod.dirSize);
    if (!bytes || bytes.length < this.eod.dirSize) {
        this.error = ZipFile.DIRECTORY_INVALID;
        return false;
    }
    //Now, we scan in the central directory file entries
    var currPos = 0
    for (var i = 0; i < this.eod.dirRecords; i+=1) {
        var entry = new ZipDirectoryEntry(bytes.slice(currPos, currPos + 46));
        if (entry.error != 0) {
            this.error = entry.error;
            return false;
        }
        currPos += 46;
        //Adding the extra bytes
        var eLen = entry.getNumExtraBytes();
        entry.addExtraBytes(bytes.slice(currPos, currPos + eLen));
        if (entry.error != 0) {
            this.error = entry.error;
            return false;
        }
        currPos += eLen;
        //Finally adding the entry to our directory
        this.directory.push(entry);
    }
    return true;
}

ZipFile.prototype.scanBackwardForMagic = function(magic, startPos) {
    var currPos = startPos;
    var toMatch = magic.length - 1;
    var chunkSz = 1024;  // Larger chunks for efficiency
    console.log("scanBackwardForMagic: startPos=" + startPos + ", looking for magic bytes");

    while (currPos >= 0) {
        var start = Math.max(0, currPos - chunkSz + 1);  // +1 so chunk includes currPos
        var len = currPos - start + 1;
        var bytes = this.file.read(start, len);

        if (!bytes) {
            console.log("scanBackwardForMagic: read returned null at start=" + start + ", len=" + len);
            break;
        }

        console.log("scanBackwardForMagic: chunk start=" + start + ", len=" + len + ", bytes.length=" + bytes.length);

        // Debug: show last few bytes of file on first chunk
        if (currPos == startPos && bytes.length >= 4) {
            var lastBytes = [];
            for (var j = bytes.length - 4; j < bytes.length; j++) {
                lastBytes.push(bytes[j].toString(16));
            }
            console.log("scanBackwardForMagic: last 4 bytes of file: " + lastBytes.join(" "));
        }

        for (var i = bytes.length - 1; i >= 0; i -= 1) {
            if (bytes[i] != magic[toMatch]) {
                //Resetting toMatch
                toMatch = magic.length - 1;
                //Checking if this byte could start a new match
                if (bytes[i] == magic[toMatch]) {
                    toMatch -= 1;  // Start matching from this byte
                }
            } else {
                toMatch -= 1;
            }
            //Checking if we matched the whole string
            if (toMatch < 0) break;
        }
        if (toMatch < 0) {
            //We matched the header!
            currPos = start + i;
            console.log("scanBackwardForMagic: FOUND at position " + currPos);
            break;
        } else {
            // Move to process the chunk before this one (no overlap)
            currPos = start - 1;
        }
    }

    console.log("scanBackwardForMagic: returning " + currPos);
    //If something was found, currPos is >= 0
    return currPos;
}


// ~~~ File Retrieval ~~~

ZipFile.prototype.getFileNames = function() {
    var ret = new Array();
    ret.length = this.directory.length;
    for (var i = 0; i < this.directory.length; i+=1) {
        ret[i] = this.directory[i].fName;
    }
    return ret;
}

ZipFile.prototype.getFile = function(name) {
	name = unescape(name);
    //Fetching the directory entry of that filename
    var dirEntry = null;
    for (var i = 0; i < this.directory.length; i+=1) {
        if (this.directory[i].fName == name) {
            dirEntry = this.directory[i];
            break;
        }
    }
    if (dirEntry == null) {
        return { file: null, error: ZipFile.NO_SUCH_FILE }
    }
    
    //Trying to fetch the file header
    var start = dirEntry.offset;
    var zFile = new ZipLocalFile(this.file.read(start, 30));
    if (zFile.error != 0) {
        return { file: null, error: zFile.error };
    }
    //Now, we must fetch the extra data
	var hackOffset = 0;
	if (zFile.getCompressedSize() == 0) {
		//Great, an empty file, that might be because the file's just ignoring
		//the standard and only encodes the cSize in the central dir
		hackOffset = dirEntry.cSize;
	}
	
    zFile.addExtraBytes(
        this.file.read(start + 30, zFile.getNumExtraBytes() + hackOffset)
    );
    if (zFile.error != 0) {
        return { file: null, error: zFile.error };
    }
    //Now, we can finally return the zFile object
    return { file: zFile, error: zFile.error };
}

ZipFile.prototype.hasFile = function(name) {
	name = unescape(name);
    //Fetching the directory entry of that filename
    var dirEntry = null;
    for (var i = 0; i < this.directory.length; i+=1) {
        if (this.directory[i].fName == name) {
            dirEntry = this.directory[i];
            break;
        }
    }
    if (dirEntry == null) {
        return false;
    } else {
		return true;
	}
}

/**
 * Returns the basename of the zipfile
 */
ZipFile.prototype.getBasename = function() {
	return this.file.getBasename();
}

// ~~~ Central Directory File Entry ~~~

function ZipDirectoryEntry(bytes) {
    this.error = 0;
    //Checking if enough bytes were given
    if (!bytes || bytes.length < 46) {
        this.error = ZipFile.DIR_ENTRY_TOO_SHORT;
        return;
    }
    var b = bytes; //Simple shorthand
    //Checking if the magic number is correct
    var magic = concatBytesVar(b[3], b[2], b[1], b[0])
    if (magic != 0x02014b50) {
        this.error = ZipFile.DIR_ENTRY_NO_MAGIC;
        return;
    }
    //Initialisizing data
    // ==== Version made by ====
    this.vMadeBy = concatBytesVar(b[5], b[4]);
    // ==== Version needed to extract (minimum) ====
    this.vNeeded = concatBytesVar(b[7], b[6]);
    // ==== General purpose bit flag ====
    this.gpFlags = concatBytesVar(b[9], b[8]);
    // ==== Compression method ====
    this.compression = concatBytesVar(b[11], b[10]);
    // ==== File last modification time ====
    this.mTime = concatBytesVar(b[13], b[12]);
    // ==== File last modification date ====
    this.mDate = concatBytesVar(b[15], b[14]);
    // ==== CRC-32 ====
    this.crc32 = concatBytesVar(b[19], b[18], b[17], b[16]);
    // ==== Compressed size ====
    this.cSize = concatBytesVar(b[23], b[22], b[21], b[20]);
    // ==== Uncompressed size ====
    this.uSize = concatBytesVar(b[27], b[26], b[25], b[24]);
    // ==== File name length ====
    this.fNameLen = concatBytesVar(b[29], b[28]);
    // ==== Extra field length ====
    this.extraLen = concatBytesVar(b[31], b[30]);
    // ==== File comment length ====
    this.fCommLen = concatBytesVar(b[33], b[32]);
    // ==== Disk number where file starts ====
    this.diskNum = concatBytesVar(b[35], b[34]);
    // ==== Internal file attributes ====
    this.intAttr = concatBytesVar(b[37], b[36]);
    // ==== External file attributes ====
    this.extAttr = concatBytesVar(b[41], b[40], b[39], b[38]);
    // ==== Relative offset of local file header ====
    this.offset = concatBytesVar(b[45], b[44], b[43], b[42]);
    // ==== File name ====
    this.fName = null;
    // ==== Extra field ====
    this.extra = null;
    // ==== File comment ====
    this.comment = null;
}

ZipDirectoryEntry.prototype.getNumExtraBytes = function() {
    return this.fNameLen + this.extraLen + this.fCommLen;
}

ZipDirectoryEntry.prototype.addExtraBytes = function(bytes) {
    if (!bytes || (bytes.length < this.getNumExtraBytes())) {
        this.error = ZipFile.DIR_ENTRY_TOO_SHORT;
        return false;
    }
    //Assigning the extra bytes
    //TODO: Use ISO-8859-1 encoding in the future
    var start = 0;
    this.fName = bytesToString(bytes.slice(start, this.fNameLen));
    if (this.extraLen > 0) {
        start += this.fNameLen;
        this.extra = bytesToString(bytes.slice(start, start + this.extraLen));
    }
    if (this.fCommLen > 0) {
        start += this.extraLen;
        this.comment = bytesToString(bytes.slice(start, start + this.fCommLen));
    }
    //Parse okay
    return true;
}



// ~~~ Local File Header + Data ~~~

function ZipLocalFile(bytes) {
    this.error = 0;
    //Checking if enough bytes were given
    if (!bytes || bytes.length < 30) {
        this.error = ZipFile.FILE_HEADER_TOO_SHORT;
        return;
    }
    var b = bytes; //Simple shorthand
    //Checking if the magic number is correct
    var magic = concatBytesVar(b[3], b[2], b[1], b[0])
    if (magic != 0x04034b50) {
        this.error = ZipFile.FILE_HEADER_NO_MAGIC;
        return;
    }
    //Initialisizing data
    // ==== Version needed to extract (minimum) ====
    this.vNeeded = concatBytesVar(b[5], b[4]);
    // ==== General purpose bit flag ====
    this.gpFlags = concatBytesVar(b[7], b[6]);
    // ==== Compression method ====
    this.compression = concatBytesVar(b[9], b[8]);
    // ==== File last modification time ====
    this.mTime = concatBytesVar(b[11], b[10]);
    // ==== File last modification date ====
    this.mDate = concatBytesVar(b[13], b[12]);
    // ==== CRC-32 ====
    this.crc32 = concatBytesVar(b[17], b[16], b[15], b[14]);
    // ==== Compressed size ====
    this.cSize = concatBytesVar(b[21], b[20], b[19], b[18]);
    // ==== Uncompressed size ====
    this.uSize = concatBytesVar(b[25], b[24], b[23], b[22]);
    // ==== File name length ====
    this.fNameLen = concatBytesVar(b[27], b[26]);
    // ==== Extra field length ====
    this.extraLen = concatBytesVar(b[29], b[28]);
    // ==== File name ====
    this.fName = null;
    // ==== Extra field ====
    this.extra = null;
    // ==== Compressed file data ====
    this.data = null;
    
    //Checking if the compression mode is correct
    switch (this.compression) {
        case 0: case 8: //Supported: None, DEFLATE
            break;
        default:    //Everything else is unsupported
            this.error = ZipFile.COMPRESSION_INVALID;
            return false;
    }
}

ZipLocalFile.prototype.getCompressedSize = function(){
	return this.cSize;
}

ZipLocalFile.prototype.getNumExtraBytes = function() {
    return this.fNameLen + this.extraLen + this.cSize;
}

ZipLocalFile.prototype.addExtraBytes = function(bytes) {
    //Now we check, if there are still enough bytes
    if (bytes.length < this.getNumExtraBytes) {
        this.error = ZipFile.FILE_DATA_TOO_SHORT;
        return false;
    }
    //TODO: Use ISO-8859-1 encoding in the future
    var start = 0;
    this.fName = bytesToString(bytes.slice(start, this.fNameLen));
    start += this.fNameLen;
    //Parsing extra fields
    if (this.extraLen > 0) {
        this.extra = bytesToString(bytes.slice(start, start + this.extraLen));
        start += this.extraLen;
    }
    
    //Fetching the file data, but it is NOT extracted yet
    this.data = bytes.slice(start);
    //Parse okay
    return true;
}

/**
 * This method returns the uncompressed content of the zipped file.
 * Do note that it is synchronous, and thus only works on
 * very small files without Javascript killing the thread.
 * Use uncompressAsync(), if possible.
 */
ZipLocalFile.prototype.uncompress = function() {
    if (this.error != 0) {
        //Why should we uncompress damaged files?
        return null;
    }
	
    switch (this.compression) {
        case 0: // Not compressed at all, simply returning the data
            return this.data;
        case 8: // DEFLATE compression
            var inflater = new Inflate();
			var ret = new Array();
            inflater.uncompress(ret, this.data, false);
			return ret;
        default: //No other compression method is supported
        	return null;
    }
	//This point should not be reached
	return null;
}

/**
 * Uncompresses the data of this ZipFile.
 * It will call the callback with the decompressed data.
 * @param {Object} callback
 */
ZipLocalFile.prototype.uncompressAsync = function(callback) {
	if (!callback) {
		//No sense in uncompressing when nobody wants the data
		return;
	}
    if (this.error != 0) {
        //Why should we uncompress damaged files?
		callback(null);
        return;
    }
	
    switch (this.compression) {
        case 0: // Not compressed at all, simply returning the data
            callback(this.data);
            break;
        case 8: // DEFLATE compression
            var inflater = new Inflate();
            inflater.uncompressAsync(this.data, false, callback);
            break;
        default: //No other compression method is supported
        	callback(null);
            return;
    }
}