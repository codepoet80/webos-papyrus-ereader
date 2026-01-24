/**
 * Translates an array of bytes from CP-949 to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateCP949(bytes) {
	console.log("translateCP949");
	//At first we check if the cp936 translation table is okay
	if (cp949table == null) {
		//We decode the compressed table from cp949data
		var bytes = base64ToBytes(cp949data);
		var decBytes = new Array();
		new Inflate().uncompress(decBytes, bytes);
		//The result is an array of 8-bit bytes that we translate into
		//the real table of 16-bit codes
		cp949table = new Array();
		for (var i = 0; i < decBytes.length; i+=2) {
			var code = (decBytes[i] << 8) + decBytes[i+1];
			cp949table.push(code);
		}
	}
	var byteBuf = new Array();
	var drop = 0;
	for (var i = 0; i < bytes.length; i+=1) {
		var code = bytes[i];
		if (code <= 0x7F) {
			//The code is pushed directly
			byteBuf.push(code);
		} else {
			//Dealing with a two-byte code; checking if it's sane
			if (i+1 >= bytes.length) {
				//We can't read that last byte; setting drop and leaving
				drop = 1;
				break;
			}
			code = (bytes[i] << 8) + bytes[++i];
			//The table only contains the two-byte codes; and stops at 0xFDFE
			if (code >= 0x8140 && code <= 0xFDFE) {
				//The code must be translated; a shift of 0 means an invalid char
				var shift = cp949table[code - 0x8140];
				code = (shift != 0) ? code - shift : 0xFFFD;
			} else {
				//Invalid codes are set to the UTF replacement char
				code = 0xFFFD;
			}
			//Pushing the translated code
			byteBuf.push(code);	
		}
	}
	return {
		dropped: drop,
		data: byteBuf
	};
}
