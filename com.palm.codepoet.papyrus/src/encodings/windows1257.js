/**
 * Translates an array of bytes from Windows-1257 to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateWindows1257(bytes) {
	var byteBuf = new Array();
	for (var i = 0; i < bytes.length; i+=1) {
		var code = bytes[i];
		switch (bytes[i]) {
			case 0x80: code = 0x20AC; break; //EURO SIGN
			case 0x82: code = 0x201A; break; //SINGLE LOW-9 QUOTATION MARK
			case 0x84: code = 0x201E; break; //DOUBLE LOW-9 QUOTATION MARK
			case 0x85: code = 0x2026; break; //HORIZONTAL ELLIPSIS
			case 0x86: code = 0x2020; break; //DAGGER
			case 0x87: code = 0x2021; break; //DOUBLE DAGGER
			case 0x89: code = 0x2030; break; //PER MILLE SIGN
			case 0x8B: code = 0x2039; break; //SINGLE LEFT-POINTING ANGLE QUOTATION MARK
			case 0x8D: code = 0x00A8; break; //DIAERESIS
			case 0x8E: code = 0x02C7; break; //CARON
			case 0x8F: code = 0x00B8; break; //CEDILLA
			case 0x91: code = 0x2018; break; //LEFT SINGLE QUOTATION MARK
			case 0x92: code = 0x2019; break; //RIGHT SINGLE QUOTATION MARK
			case 0x93: code = 0x201C; break; //LEFT DOUBLE QUOTATION MARK
			case 0x94: code = 0x201D; break; //RIGHT DOUBLE QUOTATION MARK
			case 0x95: code = 0x2022; break; //BULLET
			case 0x96: code = 0x2013; break; //EN DASH
			case 0x97: code = 0x2014; break; //EM DASH
			case 0x99: code = 0x2122; break; //TRADE MARK SIGN
			case 0x9B: code = 0x203A; break; //SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
			case 0x9D: code = 0x00AF; break; //MACRON
			case 0x9E: code = 0x02DB; break; //OGONEK
			case 0xA0: code = 0x00A0; break; //NO-BREAK SPACE
			case 0xA2: code = 0x00A2; break; //CENT SIGN
			case 0xA3: code = 0x00A3; break; //POUND SIGN
			case 0xA4: code = 0x00A4; break; //CURRENCY SIGN
			case 0xA6: code = 0x00A6; break; //BROKEN BAR
			case 0xA7: code = 0x00A7; break; //SECTION SIGN
			case 0xA8: code = 0x00D8; break; //LATIN CAPITAL LETTER O WITH STROKE
			case 0xA9: code = 0x00A9; break; //COPYRIGHT SIGN
			case 0xAA: code = 0x0156; break; //LATIN CAPITAL LETTER R WITH CEDILLA
			case 0xAB: code = 0x00AB; break; //LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xAC: code = 0x00AC; break; //NOT SIGN
			case 0xAD: code = 0x00AD; break; //SOFT HYPHEN
			case 0xAE: code = 0x00AE; break; //REGISTERED SIGN
			case 0xAF: code = 0x00C6; break; //LATIN CAPITAL LETTER AE
			case 0xB0: code = 0x00B0; break; //DEGREE SIGN
			case 0xB1: code = 0x00B1; break; //PLUS-MINUS SIGN
			case 0xB2: code = 0x00B2; break; //SUPERSCRIPT TWO
			case 0xB3: code = 0x00B3; break; //SUPERSCRIPT THREE
			case 0xB4: code = 0x00B4; break; //ACUTE ACCENT
			case 0xB5: code = 0x00B5; break; //MICRO SIGN
			case 0xB6: code = 0x00B6; break; //PILCROW SIGN
			case 0xB7: code = 0x00B7; break; //MIDDLE DOT
			case 0xB8: code = 0x00F8; break; //LATIN SMALL LETTER O WITH STROKE
			case 0xB9: code = 0x00B9; break; //SUPERSCRIPT ONE
			case 0xBA: code = 0x0157; break; //LATIN SMALL LETTER R WITH CEDILLA
			case 0xBB: code = 0x00BB; break; //RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xBC: code = 0x00BC; break; //VULGAR FRACTION ONE QUARTER
			case 0xBD: code = 0x00BD; break; //VULGAR FRACTION ONE HALF
			case 0xBE: code = 0x00BE; break; //VULGAR FRACTION THREE QUARTERS
			case 0xBF: code = 0x00E6; break; //LATIN SMALL LETTER AE
			case 0xC0: code = 0x0104; break; //LATIN CAPITAL LETTER A WITH OGONEK
			case 0xC1: code = 0x012E; break; //LATIN CAPITAL LETTER I WITH OGONEK
			case 0xC2: code = 0x0100; break; //LATIN CAPITAL LETTER A WITH MACRON
			case 0xC3: code = 0x0106; break; //LATIN CAPITAL LETTER C WITH ACUTE
			case 0xC4: code = 0x00C4; break; //LATIN CAPITAL LETTER A WITH DIAERESIS
			case 0xC5: code = 0x00C5; break; //LATIN CAPITAL LETTER A WITH RING ABOVE
			case 0xC6: code = 0x0118; break; //LATIN CAPITAL LETTER E WITH OGONEK
			case 0xC7: code = 0x0112; break; //LATIN CAPITAL LETTER E WITH MACRON
			case 0xC8: code = 0x010C; break; //LATIN CAPITAL LETTER C WITH CARON
			case 0xC9: code = 0x00C9; break; //LATIN CAPITAL LETTER E WITH ACUTE
			case 0xCA: code = 0x0179; break; //LATIN CAPITAL LETTER Z WITH ACUTE
			case 0xCB: code = 0x0116; break; //LATIN CAPITAL LETTER E WITH DOT ABOVE
			case 0xCC: code = 0x0122; break; //LATIN CAPITAL LETTER G WITH CEDILLA
			case 0xCD: code = 0x0136; break; //LATIN CAPITAL LETTER K WITH CEDILLA
			case 0xCE: code = 0x012A; break; //LATIN CAPITAL LETTER I WITH MACRON
			case 0xCF: code = 0x013B; break; //LATIN CAPITAL LETTER L WITH CEDILLA
			case 0xD0: code = 0x0160; break; //LATIN CAPITAL LETTER S WITH CARON
			case 0xD1: code = 0x0143; break; //LATIN CAPITAL LETTER N WITH ACUTE
			case 0xD2: code = 0x0145; break; //LATIN CAPITAL LETTER N WITH CEDILLA
			case 0xD3: code = 0x00D3; break; //LATIN CAPITAL LETTER O WITH ACUTE
			case 0xD4: code = 0x014C; break; //LATIN CAPITAL LETTER O WITH MACRON
			case 0xD5: code = 0x00D5; break; //LATIN CAPITAL LETTER O WITH TILDE
			case 0xD6: code = 0x00D6; break; //LATIN CAPITAL LETTER O WITH DIAERESIS
			case 0xD7: code = 0x00D7; break; //MULTIPLICATION SIGN
			case 0xD8: code = 0x0172; break; //LATIN CAPITAL LETTER U WITH OGONEK
			case 0xD9: code = 0x0141; break; //LATIN CAPITAL LETTER L WITH STROKE
			case 0xDA: code = 0x015A; break; //LATIN CAPITAL LETTER S WITH ACUTE
			case 0xDB: code = 0x016A; break; //LATIN CAPITAL LETTER U WITH MACRON
			case 0xDC: code = 0x00DC; break; //LATIN CAPITAL LETTER U WITH DIAERESIS
			case 0xDD: code = 0x017B; break; //LATIN CAPITAL LETTER Z WITH DOT ABOVE
			case 0xDE: code = 0x017D; break; //LATIN CAPITAL LETTER Z WITH CARON
			case 0xDF: code = 0x00DF; break; //LATIN SMALL LETTER SHARP S
			case 0xE0: code = 0x0105; break; //LATIN SMALL LETTER A WITH OGONEK
			case 0xE1: code = 0x012F; break; //LATIN SMALL LETTER I WITH OGONEK
			case 0xE2: code = 0x0101; break; //LATIN SMALL LETTER A WITH MACRON
			case 0xE3: code = 0x0107; break; //LATIN SMALL LETTER C WITH ACUTE
			case 0xE4: code = 0x00E4; break; //LATIN SMALL LETTER A WITH DIAERESIS
			case 0xE5: code = 0x00E5; break; //LATIN SMALL LETTER A WITH RING ABOVE
			case 0xE6: code = 0x0119; break; //LATIN SMALL LETTER E WITH OGONEK
			case 0xE7: code = 0x0113; break; //LATIN SMALL LETTER E WITH MACRON
			case 0xE8: code = 0x010D; break; //LATIN SMALL LETTER C WITH CARON
			case 0xE9: code = 0x00E9; break; //LATIN SMALL LETTER E WITH ACUTE
			case 0xEA: code = 0x017A; break; //LATIN SMALL LETTER Z WITH ACUTE
			case 0xEB: code = 0x0117; break; //LATIN SMALL LETTER E WITH DOT ABOVE
			case 0xEC: code = 0x0123; break; //LATIN SMALL LETTER G WITH CEDILLA
			case 0xED: code = 0x0137; break; //LATIN SMALL LETTER K WITH CEDILLA
			case 0xEE: code = 0x012B; break; //LATIN SMALL LETTER I WITH MACRON
			case 0xEF: code = 0x013C; break; //LATIN SMALL LETTER L WITH CEDILLA
			case 0xF0: code = 0x0161; break; //LATIN SMALL LETTER S WITH CARON
			case 0xF1: code = 0x0144; break; //LATIN SMALL LETTER N WITH ACUTE
			case 0xF2: code = 0x0146; break; //LATIN SMALL LETTER N WITH CEDILLA
			case 0xF3: code = 0x00F3; break; //LATIN SMALL LETTER O WITH ACUTE
			case 0xF4: code = 0x014D; break; //LATIN SMALL LETTER O WITH MACRON
			case 0xF5: code = 0x00F5; break; //LATIN SMALL LETTER O WITH TILDE
			case 0xF6: code = 0x00F6; break; //LATIN SMALL LETTER O WITH DIAERESIS
			case 0xF7: code = 0x00F7; break; //DIVISION SIGN
			case 0xF8: code = 0x0173; break; //LATIN SMALL LETTER U WITH OGONEK
			case 0xF9: code = 0x0142; break; //LATIN SMALL LETTER L WITH STROKE
			case 0xFA: code = 0x015B; break; //LATIN SMALL LETTER S WITH ACUTE
			case 0xFB: code = 0x016B; break; //LATIN SMALL LETTER U WITH MACRON
			case 0xFC: code = 0x00FC; break; //LATIN SMALL LETTER U WITH DIAERESIS
			case 0xFD: code = 0x017C; break; //LATIN SMALL LETTER Z WITH DOT ABOVE
			case 0xFE: code = 0x017E; break; //LATIN SMALL LETTER Z WITH CARON
			case 0xFF: code = 0x02D9; break; //DOT ABOVE
		}
		//Pushing the translated code
		byteBuf.push(code);
	}
	return {
		dropped: 0,
		data: byteBuf
	};
}