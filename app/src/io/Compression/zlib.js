/*
 * minimal zlib
 */
function Zlib() {
    //Empty constructor - properties are overwritten/created by decompress()
}

Zlib.prototype.decompress = function(bytes) {
	var decBytes = new Array();
	var state = 1;
	var byteBuf = new Array();
    for (var i = 0; i < bytes.length; i += 1) {
		var b = bytes[i];
		switch (state) {
			case 1: //ZLIB Header
				//Gobbling bytes
				if (byteBuf.length < 2) { byteBuf.push(b); };
				if (byteBuf.length < 2) { break; };
				//Fetching compression info 
				this.CM = byteBuf[0] & 0x0F;
				this.CINFO = (byteBuf[0] & 0xF0) >> 4;
				this.LZ77Window = 2^(this.CINFO - 2);
				//Fetching flag
				this.FCHECK = byteBuf[1] & 0x1F;
				this.FDICT = (byteBuf[1] & 0x20) >> 5;
				this.FLEVEL = (byteBuf[1] & 0xC0) >> 6;
				//Checking if we need to parse a dictID
				if (this.FDICT != 0) {
					state += 1;
				} else {
					state += 2;
				}
				byteBuf.length = 0;
				break;
			case 2: //Parsing the dictID
				if (byteBuf.length < 4) { byteBuf.push(b); break; };
				if (byteBuf.length < 4) { break; };
				this.DICTID = concatBytes(byteBuf);
				byteBuf.length = 0;
				state += 1;
				break;
			case 3: //The compressed data stream
				//Gobbling bytes
				if (i < bytes.length - 4) { byteBuf.push(b); };
				if (i < bytes.length - 4) { break; };
				//Creating a ZLib Inflater
				var flate = new Inflate();
				var okay = flate.uncompress(decBytes, byteBuf);
				if (okay != JSINF_OK) {
					console.error("Could not decompress the Zlib stream.");
				}
				state += 1;
				byteBuf.length = 0;
				break;
			case 4: //ADLER 32 code
				//We store it, but ignore it for the moment
				if (byteBuf.length < 4) { byteBuf.push(b); };
				if (byteBuf.length < 4) { break; };
				this.ADLER32 = concatBytes(byteBuf);
				byteBuf.length = 0;
				break;
		}
	}
	return decBytes;
}
