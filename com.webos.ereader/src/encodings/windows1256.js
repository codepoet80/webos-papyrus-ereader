/**
 * Translates an array of bytes from Windows-1256 to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateWindows1256(bytes) {
	var byteBuf = new Array();
	for (var i = 0; i < bytes.length; i+=1) {
		var code = bytes[i];
		switch (bytes[i]) {
			case 0x80: code = 0x20AC; break; //EURO SIGN
			case 0x81: code = 0x067E; break; //ARABIC LETTER PEH
			case 0x82: code = 0x201A; break; //SINGLE LOW-9 QUOTATION MARK
			case 0x83: code = 0x0192; break; //LATIN SMALL LETTER F WITH HOOK
			case 0x84: code = 0x201E; break; //DOUBLE LOW-9 QUOTATION MARK
			case 0x85: code = 0x2026; break; //HORIZONTAL ELLIPSIS
			case 0x86: code = 0x2020; break; //DAGGER
			case 0x87: code = 0x2021; break; //DOUBLE DAGGER
			case 0x88: code = 0x02C6; break; //MODIFIER LETTER CIRCUMFLEX ACCENT
			case 0x89: code = 0x2030; break; //PER MILLE SIGN
			case 0x8A: code = 0x0679; break; //ARABIC LETTER TTEH
			case 0x8B: code = 0x2039; break; //SINGLE LEFT-POINTING ANGLE QUOTATION MARK
			case 0x8C: code = 0x0152; break; //LATIN CAPITAL LIGATURE OE
			case 0x8D: code = 0x0686; break; //ARABIC LETTER TCHEH
			case 0x8E: code = 0x0698; break; //ARABIC LETTER JEH
			case 0x8F: code = 0x0688; break; //ARABIC LETTER DDAL
			case 0x90: code = 0x06AF; break; //ARABIC LETTER GAF
			case 0x91: code = 0x2018; break; //LEFT SINGLE QUOTATION MARK
			case 0x92: code = 0x2019; break; //RIGHT SINGLE QUOTATION MARK
			case 0x93: code = 0x201C; break; //LEFT DOUBLE QUOTATION MARK
			case 0x94: code = 0x201D; break; //RIGHT DOUBLE QUOTATION MARK
			case 0x95: code = 0x2022; break; //BULLET
			case 0x96: code = 0x2013; break; //EN DASH
			case 0x97: code = 0x2014; break; //EM DASH
			case 0x98: code = 0x06A9; break; //ARABIC LETTER KEHEH
			case 0x99: code = 0x2122; break; //TRADE MARK SIGN
			case 0x9A: code = 0x0691; break; //ARABIC LETTER RREH
			case 0x9B: code = 0x203A; break; //SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
			case 0x9C: code = 0x0153; break; //LATIN SMALL LIGATURE OE
			case 0x9D: code = 0x200C; break; //ZERO WIDTH NON-JOINER
			case 0x9E: code = 0x200D; break; //ZERO WIDTH JOINER
			case 0x9F: code = 0x06BA; break; //ARABIC LETTER NOON GHUNNA
			case 0xA0: code = 0x00A0; break; //NO-BREAK SPACE
			case 0xA1: code = 0x060C; break; //ARABIC COMMA
			case 0xA2: code = 0x00A2; break; //CENT SIGN
			case 0xA3: code = 0x00A3; break; //POUND SIGN
			case 0xA4: code = 0x00A4; break; //CURRENCY SIGN
			case 0xA5: code = 0x00A5; break; //YEN SIGN
			case 0xA6: code = 0x00A6; break; //BROKEN BAR
			case 0xA7: code = 0x00A7; break; //SECTION SIGN
			case 0xA8: code = 0x00A8; break; //DIAERESIS
			case 0xA9: code = 0x00A9; break; //COPYRIGHT SIGN
			case 0xAA: code = 0x06BE; break; //ARABIC LETTER HEH DOACHASHMEE
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
			case 0xBA: code = 0x061B; break; //ARABIC SEMICOLON
			case 0xBB: code = 0x00BB; break; //RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xBC: code = 0x00BC; break; //VULGAR FRACTION ONE QUARTER
			case 0xBD: code = 0x00BD; break; //VULGAR FRACTION ONE HALF
			case 0xBE: code = 0x00BE; break; //VULGAR FRACTION THREE QUARTERS
			case 0xBF: code = 0x061F; break; //ARABIC QUESTION MARK
			case 0xC0: code = 0x06C1; break; //ARABIC LETTER HEH GOAL
			case 0xC1: code = 0x0621; break; //ARABIC LETTER HAMZA
			case 0xC2: code = 0x0622; break; //ARABIC LETTER ALEF WITH MADDA ABOVE
			case 0xC3: code = 0x0623; break; //ARABIC LETTER ALEF WITH HAMZA ABOVE
			case 0xC4: code = 0x0624; break; //ARABIC LETTER WAW WITH HAMZA ABOVE
			case 0xC5: code = 0x0625; break; //ARABIC LETTER ALEF WITH HAMZA BELOW
			case 0xC6: code = 0x0626; break; //ARABIC LETTER YEH WITH HAMZA ABOVE
			case 0xC7: code = 0x0627; break; //ARABIC LETTER ALEF
			case 0xC8: code = 0x0628; break; //ARABIC LETTER BEH
			case 0xC9: code = 0x0629; break; //ARABIC LETTER TEH MARBUTA
			case 0xCA: code = 0x062A; break; //ARABIC LETTER TEH
			case 0xCB: code = 0x062B; break; //ARABIC LETTER THEH
			case 0xCC: code = 0x062C; break; //ARABIC LETTER JEEM
			case 0xCD: code = 0x062D; break; //ARABIC LETTER HAH
			case 0xCE: code = 0x062E; break; //ARABIC LETTER KHAH
			case 0xCF: code = 0x062F; break; //ARABIC LETTER DAL
			case 0xD0: code = 0x0630; break; //ARABIC LETTER THAL
			case 0xD1: code = 0x0631; break; //ARABIC LETTER REH
			case 0xD2: code = 0x0632; break; //ARABIC LETTER ZAIN
			case 0xD3: code = 0x0633; break; //ARABIC LETTER SEEN
			case 0xD4: code = 0x0634; break; //ARABIC LETTER SHEEN
			case 0xD5: code = 0x0635; break; //ARABIC LETTER SAD
			case 0xD6: code = 0x0636; break; //ARABIC LETTER DAD
			case 0xD7: code = 0x00D7; break; //MULTIPLICATION SIGN
			case 0xD8: code = 0x0637; break; //ARABIC LETTER TAH
			case 0xD9: code = 0x0638; break; //ARABIC LETTER ZAH
			case 0xDA: code = 0x0639; break; //ARABIC LETTER AIN
			case 0xDB: code = 0x063A; break; //ARABIC LETTER GHAIN
			case 0xDC: code = 0x0640; break; //ARABIC TATWEEL
			case 0xDD: code = 0x0641; break; //ARABIC LETTER FEH
			case 0xDE: code = 0x0642; break; //ARABIC LETTER QAF
			case 0xDF: code = 0x0643; break; //ARABIC LETTER KAF
			case 0xE0: code = 0x00E0; break; //LATIN SMALL LETTER A WITH GRAVE
			case 0xE1: code = 0x0644; break; //ARABIC LETTER LAM
			case 0xE2: code = 0x00E2; break; //LATIN SMALL LETTER A WITH CIRCUMFLEX
			case 0xE3: code = 0x0645; break; //ARABIC LETTER MEEM
			case 0xE4: code = 0x0646; break; //ARABIC LETTER NOON
			case 0xE5: code = 0x0647; break; //ARABIC LETTER HEH
			case 0xE6: code = 0x0648; break; //ARABIC LETTER WAW
			case 0xE7: code = 0x00E7; break; //LATIN SMALL LETTER C WITH CEDILLA
			case 0xE8: code = 0x00E8; break; //LATIN SMALL LETTER E WITH GRAVE
			case 0xE9: code = 0x00E9; break; //LATIN SMALL LETTER E WITH ACUTE
			case 0xEA: code = 0x00EA; break; //LATIN SMALL LETTER E WITH CIRCUMFLEX
			case 0xEB: code = 0x00EB; break; //LATIN SMALL LETTER E WITH DIAERESIS
			case 0xEC: code = 0x0649; break; //ARABIC LETTER ALEF MAKSURA
			case 0xED: code = 0x064A; break; //ARABIC LETTER YEH
			case 0xEE: code = 0x00EE; break; //LATIN SMALL LETTER I WITH CIRCUMFLEX
			case 0xEF: code = 0x00EF; break; //LATIN SMALL LETTER I WITH DIAERESIS
			case 0xF0: code = 0x064B; break; //ARABIC FATHATAN
			case 0xF1: code = 0x064C; break; //ARABIC DAMMATAN
			case 0xF2: code = 0x064D; break; //ARABIC KASRATAN
			case 0xF3: code = 0x064E; break; //ARABIC FATHA
			case 0xF4: code = 0x00F4; break; //LATIN SMALL LETTER O WITH CIRCUMFLEX
			case 0xF5: code = 0x064F; break; //ARABIC DAMMA
			case 0xF6: code = 0x0650; break; //ARABIC KASRA
			case 0xF7: code = 0x00F7; break; //DIVISION SIGN
			case 0xF8: code = 0x0651; break; //ARABIC SHADDA
			case 0xF9: code = 0x00F9; break; //LATIN SMALL LETTER U WITH GRAVE
			case 0xFA: code = 0x0652; break; //ARABIC SUKUN
			case 0xFB: code = 0x00FB; break; //LATIN SMALL LETTER U WITH CIRCUMFLEX
			case 0xFC: code = 0x00FC; break; //LATIN SMALL LETTER U WITH DIAERESIS
			case 0xFD: code = 0x200E; break; //LEFT-TO-RIGHT MARK
			case 0xFE: code = 0x200F; break; //RIGHT-TO-LEFT MARK
			case 0xFF: code = 0x06D2; break; //ARABIC LETTER YEH BARREE
		}
		//Pushing the translated code
		byteBuf.push(code);
	}
	return {
		dropped: 0,
		data: byteBuf
	};
}