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
			case 0x2000: case 0x2001: case 0x2002: case 0x2003:
			case 0x2004: case 0x2005: case 0x2006: case 0x2007:
			case 0x2008: case 0x2009:
			case 0x200A: // Hair space - not rendered correctly on webOS
			case 0x202F: case 0x205F: case 0x3000:
				html += " ";
				skipCharIfLF = skipCharIfCR = false;
				break;
			case 0x2010: case 0x2011: case 0x2012: case 0x2013:
				html += "-";
				skipCharIfLF = skipCharIfCR = false;
				break;
			case 0x2014:
				html += "--";
				skipCharIfLF = skipCharIfCR = false;
				break;
			case 0x2018: case 0x2019:
				html += "'";
				skipCharIfLF = skipCharIfCR = false;
				break;
			case 0x201C: case 0x201D:
				html += "\"";
				skipCharIfLF = skipCharIfCR = false;
				break;
			case 0x2026:
				html += "...";
				skipCharIfLF = skipCharIfCR = false;
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
