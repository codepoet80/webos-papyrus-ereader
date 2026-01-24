/**
 * Translates an array of bytes from Windows-1254 to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateWindows1254(bytes) {
	var byteBuf = new Array();
	for (var i = 0; i < bytes.length; i+=1) {
		var code = bytes[i];
		switch (bytes[i]) {
			case 0x82: code = 0x201A; break; //SINGLE LOW-9 QUOTATION MARK
			case 0x83: code = 0x0192; break; //LATIN SMALL LETTER F WITH HOOK
			case 0x84: code = 0x201E; break; //DOUBLE LOW-9 QUOTATION MARK
			case 0x85: code = 0x2026; break; //HORIZONTAL ELLIPSIS
			case 0x86: code = 0x2020; break; //DAGGER
			case 0x87: code = 0x2021; break; //DOUBLE DAGGER
			case 0x88: code = 0x02C6; break; //MODIFIER LETTER CIRCUMFLEX ACCENT
			case 0x89: code = 0x2030; break; //PER MILLE SIGN
			case 0x8A: code = 0x0160; break; //LATIN CAPITAL LETTER S WITH CARON
			case 0x8B: code = 0x2039; break; //SINGLE LEFT-POINTING ANGLE QUOTATION MARK
			case 0x8C: code = 0x0152; break; //LATIN CAPITAL LIGATURE OE
			case 0x91: code = 0x2018; break; //LEFT SINGLE QUOTATION MARK
			case 0x92: code = 0x2019; break; //RIGHT SINGLE QUOTATION MARK
			case 0x93: code = 0x201C; break; //LEFT DOUBLE QUOTATION MARK
			case 0x94: code = 0x201D; break; //RIGHT DOUBLE QUOTATION MARK
			case 0x95: code = 0x2022; break; //BULLET
			case 0x96: code = 0x2013; break; //EN DASH
			case 0x97: code = 0x2014; break; //EM DASH
			case 0x98: code = 0x02DC; break; //SMALL TILDE
			case 0x99: code = 0x2122; break; //TRADE MARK SIGN
			case 0x9A: code = 0x0161; break; //LATIN SMALL LETTER S WITH CARON
			case 0x9B: code = 0x203A; break; //SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
			case 0x9C: code = 0x0153; break; //LATIN SMALL LIGATURE OE
			case 0x9F: code = 0x0178; break; //LATIN CAPITAL LETTER Y WITH DIAERESIS
			case 0xA0: code = 0x00A0; break; //NO-BREAK SPACE
			case 0xA1: code = 0x00A1; break; //INVERTED EXCLAMATION MARK
			case 0xA2: code = 0x00A2; break; //CENT SIGN
			case 0xA3: code = 0x00A3; break; //POUND SIGN
			case 0xA4: code = 0x00A4; break; //CURRENCY SIGN
			case 0xA5: code = 0x00A5; break; //YEN SIGN
			case 0xA6: code = 0x00A6; break; //BROKEN BAR
			case 0xA7: code = 0x00A7; break; //SECTION SIGN
			case 0xA8: code = 0x00A8; break; //DIAERESIS
			case 0xA9: code = 0x00A9; break; //COPYRIGHT SIGN
			case 0xAA: code = 0x00AA; break; //FEMININE ORDINAL INDICATOR
			case 0xAB: code = 0x00AB; break; //LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xAC: code = 0x00AC; break; //NOT SIGN
			case 0xAD: code = 0x00AD; break; //SOFT HYPHEN
			case 0xAE: code = 0x00AE; break; //REGISTERED SIGN
			case 0xAF: code = 0x00AF; break; //MACRON
			case 0xB0: code = 0x00B0; break; //DEGREE SIGN
			case 0xB1: code = 0x00B1; break; //PLUS-MINUS SIGN
			case 0xB2: code = 0x00B2; break; //SUPERSCRIPT TWO
			case 0xB3: code = 0x00B3; break; //SUPERSCRIPT THREE
			case 0xB4: code = 0x00B4; break; //ACUTE ACCENT
			case 0xB5: code = 0x00B5; break; //MICRO SIGN
			case 0xB6: code = 0x00B6; break; //PILCROW SIGN
			case 0xB7: code = 0x00B7; break; //MIDDLE DOT
			case 0xB8: code = 0x00B8; break; //CEDILLA
			case 0xB9: code = 0x00B9; break; //SUPERSCRIPT ONE
			case 0xBA: code = 0x00BA; break; //MASCULINE ORDINAL INDICATOR
			case 0xBB: code = 0x00BB; break; //RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xBC: code = 0x00BC; break; //VULGAR FRACTION ONE QUARTER
			case 0xBD: code = 0x00BD; break; //VULGAR FRACTION ONE HALF
			case 0xBE: code = 0x00BE; break; //VULGAR FRACTION THREE QUARTERS
			case 0xBF: code = 0x00BF; break; //INVERTED QUESTION MARK
			case 0xC0: code = 0x00C0; break; //LATIN CAPITAL LETTER A WITH GRAVE
			case 0xC1: code = 0x00C1; break; //LATIN CAPITAL LETTER A WITH ACUTE
			case 0xC2: code = 0x00C2; break; //LATIN CAPITAL LETTER A WITH CIRCUMFLEX
			case 0xC3: code = 0x00C3; break; //LATIN CAPITAL LETTER A WITH TILDE
			case 0xC4: code = 0x00C4; break; //LATIN CAPITAL LETTER A WITH DIAERESIS
			case 0xC5: code = 0x00C5; break; //LATIN CAPITAL LETTER A WITH RING ABOVE
			case 0xC6: code = 0x00C6; break; //LATIN CAPITAL LETTER AE
			case 0xC7: code = 0x00C7; break; //LATIN CAPITAL LETTER C WITH CEDILLA
			case 0xC8: code = 0x00C8; break; //LATIN CAPITAL LETTER E WITH GRAVE
			case 0xC9: code = 0x00C9; break; //LATIN CAPITAL LETTER E WITH ACUTE
			case 0xCA: code = 0x00CA; break; //LATIN CAPITAL LETTER E WITH CIRCUMFLEX
			case 0xCB: code = 0x00CB; break; //LATIN CAPITAL LETTER E WITH DIAERESIS
			case 0xCC: code = 0x00CC; break; //LATIN CAPITAL LETTER I WITH GRAVE
			case 0xCD: code = 0x00CD; break; //LATIN CAPITAL LETTER I WITH ACUTE
			case 0xCE: code = 0x00CE; break; //LATIN CAPITAL LETTER I WITH CIRCUMFLEX
			case 0xCF: code = 0x00CF; break; //LATIN CAPITAL LETTER I WITH DIAERESIS
			case 0xD0: code = 0x011E; break; //LATIN CAPITAL LETTER G WITH BREVE
			case 0xD1: code = 0x00D1; break; //LATIN CAPITAL LETTER N WITH TILDE
			case 0xD2: code = 0x00D2; break; //LATIN CAPITAL LETTER O WITH GRAVE
			case 0xD3: code = 0x00D3; break; //LATIN CAPITAL LETTER O WITH ACUTE
			case 0xD4: code = 0x00D4; break; //LATIN CAPITAL LETTER O WITH CIRCUMFLEX
			case 0xD5: code = 0x00D5; break; //LATIN CAPITAL LETTER O WITH TILDE
			case 0xD6: code = 0x00D6; break; //LATIN CAPITAL LETTER O WITH DIAERESIS
			case 0xD7: code = 0x00D7; break; //MULTIPLICATION SIGN
			case 0xD8: code = 0x00D8; break; //LATIN CAPITAL LETTER O WITH STROKE
			case 0xD9: code = 0x00D9; break; //LATIN CAPITAL LETTER U WITH GRAVE
			case 0xDA: code = 0x00DA; break; //LATIN CAPITAL LETTER U WITH ACUTE
			case 0xDB: code = 0x00DB; break; //LATIN CAPITAL LETTER U WITH CIRCUMFLEX
			case 0xDC: code = 0x00DC; break; //LATIN CAPITAL LETTER U WITH DIAERESIS
			case 0xDD: code = 0x0130; break; //LATIN CAPITAL LETTER I WITH DOT ABOVE
			case 0xDE: code = 0x015E; break; //LATIN CAPITAL LETTER S WITH CEDILLA
			case 0xDF: code = 0x00DF; break; //LATIN SMALL LETTER SHARP S
			case 0xE0: code = 0x00E0; break; //LATIN SMALL LETTER A WITH GRAVE
			case 0xE1: code = 0x00E1; break; //LATIN SMALL LETTER A WITH ACUTE
			case 0xE2: code = 0x00E2; break; //LATIN SMALL LETTER A WITH CIRCUMFLEX
			case 0xE3: code = 0x00E3; break; //LATIN SMALL LETTER A WITH TILDE
			case 0xE4: code = 0x00E4; break; //LATIN SMALL LETTER A WITH DIAERESIS
			case 0xE5: code = 0x00E5; break; //LATIN SMALL LETTER A WITH RING ABOVE
			case 0xE6: code = 0x00E6; break; //LATIN SMALL LETTER AE
			case 0xE7: code = 0x00E7; break; //LATIN SMALL LETTER C WITH CEDILLA
			case 0xE8: code = 0x00E8; break; //LATIN SMALL LETTER E WITH GRAVE
			case 0xE9: code = 0x00E9; break; //LATIN SMALL LETTER E WITH ACUTE
			case 0xEA: code = 0x00EA; break; //LATIN SMALL LETTER E WITH CIRCUMFLEX
			case 0xEB: code = 0x00EB; break; //LATIN SMALL LETTER E WITH DIAERESIS
			case 0xEC: code = 0x00EC; break; //LATIN SMALL LETTER I WITH GRAVE
			case 0xED: code = 0x00ED; break; //LATIN SMALL LETTER I WITH ACUTE
			case 0xEE: code = 0x00EE; break; //LATIN SMALL LETTER I WITH CIRCUMFLEX
			case 0xEF: code = 0x00EF; break; //LATIN SMALL LETTER I WITH DIAERESIS
			case 0xF0: code = 0x011F; break; //LATIN SMALL LETTER G WITH BREVE
			case 0xF1: code = 0x00F1; break; //LATIN SMALL LETTER N WITH TILDE
			case 0xF2: code = 0x00F2; break; //LATIN SMALL LETTER O WITH GRAVE
			case 0xF3: code = 0x00F3; break; //LATIN SMALL LETTER O WITH ACUTE
			case 0xF4: code = 0x00F4; break; //LATIN SMALL LETTER O WITH CIRCUMFLEX
			case 0xF5: code = 0x00F5; break; //LATIN SMALL LETTER O WITH TILDE
			case 0xF6: code = 0x00F6; break; //LATIN SMALL LETTER O WITH DIAERESIS
			case 0xF7: code = 0x00F7; break; //DIVISION SIGN
			case 0xF8: code = 0x00F8; break; //LATIN SMALL LETTER O WITH STROKE
			case 0xF9: code = 0x00F9; break; //LATIN SMALL LETTER U WITH GRAVE
			case 0xFA: code = 0x00FA; break; //LATIN SMALL LETTER U WITH ACUTE
			case 0xFB: code = 0x00FB; break; //LATIN SMALL LETTER U WITH CIRCUMFLEX
			case 0xFC: code = 0x00FC; break; //LATIN SMALL LETTER U WITH DIAERESIS
			case 0xFD: code = 0x0131; break; //LATIN SMALL LETTER DOTLESS I
			case 0xFE: code = 0x015F; break; //LATIN SMALL LETTER S WITH CEDILLA
			case 0xFF: code = 0x00FF; break; //LATIN SMALL LETTER Y WITH DIAERESIS
		}
		//Pushing the translated code
		byteBuf.push(code);
	}
	return {
		dropped: 0,
		data: byteBuf
	};
}