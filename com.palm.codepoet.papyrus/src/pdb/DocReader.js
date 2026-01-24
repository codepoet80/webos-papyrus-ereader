
function DocReader(reader, callback) {
	console.log("DocReader constructor");
    //Storing the parameters
    this.reader = reader;
    this.callback = callback;
	//The file reading mode; because Docs might contain HTML code
	//This is set from the outside, after the constructor's done
	this.plainMode = false;
    //Setting the new stream from that reader
    if (this.setStream(reader) == false) {
        //Calling the callback with null because the reader wasn't a PalmDoc
        this.callback(reader, null);
    } else {
        //It is a Palm Doc! Loading is asynchronous, so the callback is called later
    }
}

//A DocReader implements the ByteReader interface
DocReader.prototype = new ByteReader();

/**
 * Switches the input stream of the ByteReader to the given object.
 * Depending on the implementing class, inStream can be a filename,
 * an array, a string or whatever the given ByteReader specifies.
 * @param {Object} inStream the new input stream for this reader.
 */
DocReader.prototype.setStream = function(inStream) {
    //Checking if the stream is a ByteReader
    if (inStream) { // && inStream.isPrototypeOf(ByteReader)) {
        //Creating the PDBfile from that reader
        this.pdb = new PDBFile(inStream);
		
        //Now we check if the PDBFile is actually a Palm Doc Document
        if (DocRecord.isValidID(this.pdb.type, this.pdb.creator) == false) {
            //This is not a Palm DOC format
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
        this.header = new DocRecord(false, bytes);
        
        //Creating the variable for the offsets
        this.uncmpOffsets = new Array();
        this.uncmpOffsets[0] = 0;
        
        //Creating the variables for the buffering of the last record
        this.lastRecord = null;
        this.lastRecordNum = -1;
        
        //And calling the callback
        this.callback(this.reader, this);
    } else {
        throw ("Failed to pass a ByteReader to the DocReader class");
    }
    return true;
}


DocReader.prototype.loadRecord = function(num) {
	//console.log("DocReader: loadRecord; num = " + num);
    if (this.lastRecordNum == num) {
        //We've already buffered the record, returning it
        return this.lastRecord;
    }
	//Checking if the number exceeds the plainText record nums
	if (num > this.header.attribute.recordCount) {
		return null;
	}
    var bytes = this.pdb.loadRecordBytes(num);
    if (bytes && bytes != null) {
		//Fetching the open tags from the last record
		var openTags = (this.lastRecord != null)
			? this.lastRecord.openTags : null;
        record = new DocRecord(true, bytes, this.header, this.plainMode, openTags);
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
 * This method reads 'len' bytes from the Palm Doc file.
 *
 * @param {Number} start the position of the byte that should be read.
 * @param {Number} len the number of bytes that should be read.
 *         If len is not specified 1 should be assumed.
 */
DocReader.prototype.read = function(start, len) {
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
        if (num <= 0 || num > this.header.attribute.recordCount) {
            //No such record; probably EOF, returning what's in the buffer
            return buf;
        }
        //Loading that record
        var record = this.loadRecord(num);
        //Checking if record was loaded
        if (!record || record == null) {
            //Couldn't load the record, that's bad
            console.warn("Couldn't load DocRecord number " + num);
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
DocReader.prototype.readIsAsync = function() {
    return false;
}

DocReader.prototype.getRecordNumForByte = function(start) {
	//Checking if the byte's possible at all
	/*
	if (start >= this.header.attribute.textLength) {
		return -1;
	}
	*/
    for (var i = 0; i < this.uncmpOffsets.length - 1; i++) {
        if (this.uncmpOffsets[i] <= start && this.uncmpOffsets[i+1] > start) {
            return i + 1;
        }
    }
	//We check if the found number makes sense
	if (i+1 > this.header.attribute.recordCount) {
		return -1;
	} else {
		//We return the found record
    	return i + 1;	
	}
}

/**
 * Returns the length of the uncompressed underlying stream.
 */
DocReader.prototype.getLength = function() {
    //The total length is stored in the first DOC-header's records
    return this.header.attribute.textLength;
}

/**
 * Closes the input stream.
 */
DocReader.prototype.close = function(){
    //Does nothing yet
}

/**
 * Returns the data content of the image with the given label.
 * @param {Object} label the name of the image; in this case
 * 		it's the record number in which the image is stored
 * @return an array of bytes.
 */
DocReader.prototype.getImage = function(label) {
	console.log("DocReader: Fetching image " + label);
	//Sanity check
	if (typeof(label) == "undefined" || label == null) {
		return null;
	}
	//Trying to parse the label
	var recNum = parseInt(label);
	if (isNaN(recNum) || recNum <= 0) { return null; }
	//Adding the text record offset
	recNum += this.header.attribute.recordCount
	//And sanity checking that record number
	if (recNum >= this.pdb.numRecords) { return null; }
	//Now we can load the byte data of the image
	var bytes = this.pdb.loadRecordBytes(recNum);
	//Sanity checking the bytes
	if (!bytes || bytes == null) { return null; }
	return bytes;
}
