/**
 * A BitBuffer writes and reads the bits of a byte-based
 * data array.
 * 
 * @param {Array} data if present, uses the given array as
 * the foundation for the BitBuffer.
 * @param {Boolean} startAtEnd if set to true, it sets the
 * read/write pointer after the last byte, in other word,
 * it puts the buffer into "append-mode".
 * 
 */
function BitBuffer(data, startAtEnd) {
    this.data = (data) ? data : new Array();
	this.bytePos = (startAtEnd) ? data.length : 0;
	this.bitPos = 0;
	this.maxBits = this.data.length * 8;
}

/**
 * This method reads 'len' bits from the underlying byte-array,
 * but at most 8 bits.
 * 
 * @return an integer that's filled with the bits in LSB mode
 */
BitBuffer.prototype.read = function(len) {
	if (len > 8) return null;
	if (this.bytePos >= this.data.length) return null;
	var ret = 0;
	var pos = 0;
    while (pos < len) {
        //Sanity check
        if (this.bytePos >= this.data.length) return null;
		//We determine how many bits we can read
		var num = Math.min(8 - this.bitPos, len - pos);
		//We read those bytes
        var lshift = this.bitPos;
        var rshift = 8 - (num + lshift);
        var byt = ((this.data[this.bytePos] & (0xFF >> lshift)) >> rshift);
        //Now that we have the sequence, we shift-add it to the right position
        pos += num;
        ret += ((byt << (len - pos)) & 0xFF);
		this.bitPos += num;
		if (this.bitPos >= 8) {
			this.bitPos = 0;
			this.bytePos += 1;
		}
	}
	return ret;
}

BitBuffer.prototype.write = function(data, len) {
	if (typeof(data) == "undefined" || data == null || len <= 0 || len > 8) {
		return;
	}
    //Checking if we need to add another byte
    if (this.bytePos >= this.data.length) {
        this.bitPos = 0;
        this.bytePos = this.data.length;
        this.data.push(0);
    }
	//We look how many bits we can still stuff into the current byte
	var num = Math.min(len, 8 - this.bitPos);
	//We extract the wanted bytes from data
	var byt = (data & (0xFF >> (8 - len))) & 0xFF;
	var bytL = ((byt >> (len - num)) << (8 - (num + this.bitPos))) & 0xFF;
	var bytR = (byt << ((8 - len) + num)) & 0xFF;
	
	//Adding the bits to the existing byte
	this.data[this.bytePos] += bytL;
	if (num < len) {
		//Adding the right part as a new byte
		this.data.push(bytR);
		//And setting the new bit-/bytePos
		this.bytePos += 1;
		this.bitPos = len - num;	
	} else {
		this.bitPos += num;
        if (this.bitPos >= 8) {
            this.bytePos +=1;
            this.bitPos = 0;
        }
	}
	this.maxBits += len;
}

/**
 * Returns the number of bits in the underlying stream.
 * 
 */
BitBuffer.prototype.getLength = function() {
    return this.maxBits;
}

