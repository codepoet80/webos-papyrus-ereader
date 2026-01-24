
function PackedBytes() {
	this.data = new Array();
	this.data.push(0);
	this.lastDepth = 0;
	this.length = 0;
}

PackedBytes.prototype.copyFrom = function (other) {
	this.data = other.data;
	this.lastDepth = other.lastDepth;
	this.length = other.length;
}

PackedBytes.prototype.addBytes = function (bytes) {
	//console.log("addBytes");
	//Sanity check
	if (!bytes || bytes.length <= 0) {
		return;
	}
	//We push the bytes
	for (var i = 0; i < bytes.length; i+=1) {
		this.push(bytes[i]);
	}
	//Recalculating the length
	this.length = this.getLength();
}

PackedBytes.prototype.push = function(byt) {
	//Checking if we push into the existing byte, or fetch the last one
	if (this.lastDepth >= 4) {
		//We must create a new byte
		this.data.push(0);
		this.lastDepth = 1;
	}
	//We push the byt into the last byte
	var b = this.data.pop();
	var depth = 8 * (3 - this.lastDepth);
	b += byt << depth;
	this.data.push(b); 
	//And then increase lastDepth
	this.lastDepth += 1;
	
	//Setting new length
	this.length += 1;
}

PackedBytes.prototype.get = function(pos) {
	//Checking which integer is hit
	bPos = Math.floor(pos / 4);
	//Sanity check
	if (bPos < 0 || bPos >= this.data.length) {
		return null;
	}
	//Fetching that integer
	var byt = this.data[bPos];
	//Fetching the position in the int
	var subPos = 3 - (pos % 4);
	var ret = (byt >> (8 * subPos)) & 0xFF;
	//Extracting the byte
	return ret;
}

PackedBytes.prototype.getLength = function() {
	var len = this.data.length;
	if (len <= 1) {
		return this.lastDepth;
	} else {
		len = (len - 1) * 4 + this.lastDepth;
	}
	return len;
}

PackedBytes.prototype.slice = function(start, end) {
	//TODO: This method can surely be made faster
	if (typeof(end) == "undefined" || end < 0 || end > this.length) {
		var end = this.length;
	}
	//Sanitizing start
	start = (start < 0) ? 0 : (start >= this.length) ? this.length : start;
	//And fetching the bytes
	var ret = new PackedBytes();
	for (var i = start; i < end; i+=1) {
		ret.push(this.get(i));
	}
	return ret;
}

PackedBytes.prototype.getUnpacked = function(start, end) {
	//console.log("slice");
	//TODO: This method can surely be made faster
	if (typeof(end) == "undefined" || end < 0 || end > this.length) {
		var end = this.length;
	}
	//Sanitizing start
	start = (start < 0) ? 0 : (start >= this.length) ? this.length : start;
	//And fetching the bytes
	var ret = new Array();
	for (var i = start; i < end; i+=1) {
		ret.push(this.get(i));
	}
	return ret;
}