/**
 * Takes a string containing plain text and converts it to formatted
 * html. It converts linebreaks and masks special characters.
 */
function text2html(text) {
    var html;
    //At first, we replace the line breaks
    html = text.replace(/\r?\n/g, "<br/>");
    //Then, we mask the special chars
    
    //And we return the html content
    return html;
}

function bytes2html(bytes) {
    var html = new String();
	var skipCharIfLF = false;
	var skipCharIfCR = false;
    for (var i = 0; i < bytes.length; i+=1) {
		var chr = bytes[i];
		switch(chr) {
			case 0x0D: //CR - Carriage Return
				if (skipCharIfCR) { skipCharIfCR = false; break; }
				html += "<br/>";
				skipCharIfLF = true;
				break;
			case 0x0A: //LF - Line Feed
				if (skipCharIfLF) { skipCharIfLF = false; break; }
				html += "<br/>";
				skipCharIfCR = true;
				break;
			default: //Everything else
				html += String.fromCharCode(chr);
				//We read something else but a CR/LF
				skipCharIfLF = skipCharIfCR = false;
				break;
		}
    }
    return html;
}