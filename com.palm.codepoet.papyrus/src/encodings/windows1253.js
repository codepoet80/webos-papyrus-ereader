/**
 * Translates an array of bytes from Windows-1253 to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateWindows1253(bytes) {
	var byteBuf = new Array();
	for (var i = 0; i < bytes.length; i+=1) {
		var code = bytes[i];
		switch (bytes[i]) {
			case 0x80: code = 0x20AC; break; //EURO SIGN
			case 0x82: code = 0x201A; break; //SINGLE LOW-9 QUOTATION MARK
			case 0x83: code = 0x0192; break; //LATIN SMALL LETTER F WITH HOOK
			case 0x84: code = 0x201E; break; //DOUBLE LOW-9 QUOTATION MARK
			case 0x85: code = 0x2026; break; //HORIZONTAL ELLIPSIS
			case 0x86: code = 0x2020; break; //DAGGER
			case 0x87: code = 0x2021; break; //DOUBLE DAGGER
			case 0x89: code = 0x2030; break; //PER MILLE SIGN
			case 0x8B: code = 0x2039; break; //SINGLE LEFT-POINTING ANGLE QUOTATION MARK
			case 0x91: code = 0x2018; break; //LEFT SINGLE QUOTATION MARK
			case 0x92: code = 0x2019; break; //RIGHT SINGLE QUOTATION MARK
			case 0x93: code = 0x201C; break; //LEFT DOUBLE QUOTATION MARK
			case 0x94: code = 0x201D; break; //RIGHT DOUBLE QUOTATION MARK
			case 0x95: code = 0x2022; break; //BULLET
			case 0x96: code = 0x2013; break; //EN DASH
			case 0x97: code = 0x2014; break; //EM DASH
			case 0x99: code = 0x2122; break; //TRADE MARK SIGN
			case 0x9B: code = 0x203A; break; //SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
			case 0xA0: code = 0x00A0; break; //NO-BREAK SPACE
			case 0xA1: code = 0x0385; break; //GREEK DIALYTIKA TONOS
			case 0xA2: code = 0x0386; break; //GREEK CAPITAL LETTER ALPHA WITH TONOS
			case 0xA3: code = 0x00A3; break; //POUND SIGN
			case 0xA4: code = 0x00A4; break; //CURRENCY SIGN
			case 0xA5: code = 0x00A5; break; //YEN SIGN
			case 0xA6: code = 0x00A6; break; //BROKEN BAR
			case 0xA7: code = 0x00A7; break; //SECTION SIGN
			case 0xA8: code = 0x00A8; break; //DIAERESIS
			case 0xA9: code = 0x00A9; break; //COPYRIGHT SIGN
			case 0xAB: code = 0x00AB; break; //LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xAC: code = 0x00AC; break; //NOT SIGN
			case 0xAD: code = 0x00AD; break; //SOFT HYPHEN
			case 0xAE: code = 0x00AE; break; //REGISTERED SIGN
			case 0xAF: code = 0x2015; break; //HORIZONTAL BAR
			case 0xB0: code = 0x00B0; break; //DEGREE SIGN
			case 0xB1: code = 0x00B1; break; //PLUS-MINUS SIGN
			case 0xB2: code = 0x00B2; break; //SUPERSCRIPT TWO
			case 0xB3: code = 0x00B3; break; //SUPERSCRIPT THREE
			case 0xB4: code = 0x0384; break; //GREEK TONOS
			case 0xB5: code = 0x00B5; break; //MICRO SIGN
			case 0xB6: code = 0x00B6; break; //PILCROW SIGN
			case 0xB7: code = 0x00B7; break; //MIDDLE DOT
			case 0xB8: code = 0x0388; break; //GREEK CAPITAL LETTER EPSILON WITH TONOS
			case 0xB9: code = 0x0389; break; //GREEK CAPITAL LETTER ETA WITH TONOS
			case 0xBA: code = 0x038A; break; //GREEK CAPITAL LETTER IOTA WITH TONOS
			case 0xBB: code = 0x00BB; break; //RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xBC: code = 0x038C; break; //GREEK CAPITAL LETTER OMICRON WITH TONOS
			case 0xBD: code = 0x00BD; break; //VULGAR FRACTION ONE HALF
			case 0xBE: code = 0x038E; break; //GREEK CAPITAL LETTER UPSILON WITH TONOS
			case 0xBF: code = 0x038F; break; //GREEK CAPITAL LETTER OMEGA WITH TONOS
			case 0xC0: code = 0x0390; break; //GREEK SMALL LETTER IOTA WITH DIALYTIKA AND TONOS
			case 0xC1: code = 0x0391; break; //GREEK CAPITAL LETTER ALPHA
			case 0xC2: code = 0x0392; break; //GREEK CAPITAL LETTER BETA
			case 0xC3: code = 0x0393; break; //GREEK CAPITAL LETTER GAMMA
			case 0xC4: code = 0x0394; break; //GREEK CAPITAL LETTER DELTA
			case 0xC5: code = 0x0395; break; //GREEK CAPITAL LETTER EPSILON
			case 0xC6: code = 0x0396; break; //GREEK CAPITAL LETTER ZETA
			case 0xC7: code = 0x0397; break; //GREEK CAPITAL LETTER ETA
			case 0xC8: code = 0x0398; break; //GREEK CAPITAL LETTER THETA
			case 0xC9: code = 0x0399; break; //GREEK CAPITAL LETTER IOTA
			case 0xCA: code = 0x039A; break; //GREEK CAPITAL LETTER KAPPA
			case 0xCB: code = 0x039B; break; //GREEK CAPITAL LETTER LAMDA
			case 0xCC: code = 0x039C; break; //GREEK CAPITAL LETTER MU
			case 0xCD: code = 0x039D; break; //GREEK CAPITAL LETTER NU
			case 0xCE: code = 0x039E; break; //GREEK CAPITAL LETTER XI
			case 0xCF: code = 0x039F; break; //GREEK CAPITAL LETTER OMICRON
			case 0xD0: code = 0x03A0; break; //GREEK CAPITAL LETTER PI
			case 0xD1: code = 0x03A1; break; //GREEK CAPITAL LETTER RHO
			case 0xD3: code = 0x03A3; break; //GREEK CAPITAL LETTER SIGMA
			case 0xD4: code = 0x03A4; break; //GREEK CAPITAL LETTER TAU
			case 0xD5: code = 0x03A5; break; //GREEK CAPITAL LETTER UPSILON
			case 0xD6: code = 0x03A6; break; //GREEK CAPITAL LETTER PHI
			case 0xD7: code = 0x03A7; break; //GREEK CAPITAL LETTER CHI
			case 0xD8: code = 0x03A8; break; //GREEK CAPITAL LETTER PSI
			case 0xD9: code = 0x03A9; break; //GREEK CAPITAL LETTER OMEGA
			case 0xDA: code = 0x03AA; break; //GREEK CAPITAL LETTER IOTA WITH DIALYTIKA
			case 0xDB: code = 0x03AB; break; //GREEK CAPITAL LETTER UPSILON WITH DIALYTIKA
			case 0xDC: code = 0x03AC; break; //GREEK SMALL LETTER ALPHA WITH TONOS
			case 0xDD: code = 0x03AD; break; //GREEK SMALL LETTER EPSILON WITH TONOS
			case 0xDE: code = 0x03AE; break; //GREEK SMALL LETTER ETA WITH TONOS
			case 0xDF: code = 0x03AF; break; //GREEK SMALL LETTER IOTA WITH TONOS
			case 0xE0: code = 0x03B0; break; //GREEK SMALL LETTER UPSILON WITH DIALYTIKA AND TONOS
			case 0xE1: code = 0x03B1; break; //GREEK SMALL LETTER ALPHA
			case 0xE2: code = 0x03B2; break; //GREEK SMALL LETTER BETA
			case 0xE3: code = 0x03B3; break; //GREEK SMALL LETTER GAMMA
			case 0xE4: code = 0x03B4; break; //GREEK SMALL LETTER DELTA
			case 0xE5: code = 0x03B5; break; //GREEK SMALL LETTER EPSILON
			case 0xE6: code = 0x03B6; break; //GREEK SMALL LETTER ZETA
			case 0xE7: code = 0x03B7; break; //GREEK SMALL LETTER ETA
			case 0xE8: code = 0x03B8; break; //GREEK SMALL LETTER THETA
			case 0xE9: code = 0x03B9; break; //GREEK SMALL LETTER IOTA
			case 0xEA: code = 0x03BA; break; //GREEK SMALL LETTER KAPPA
			case 0xEB: code = 0x03BB; break; //GREEK SMALL LETTER LAMDA
			case 0xEC: code = 0x03BC; break; //GREEK SMALL LETTER MU
			case 0xED: code = 0x03BD; break; //GREEK SMALL LETTER NU
			case 0xEE: code = 0x03BE; break; //GREEK SMALL LETTER XI
			case 0xEF: code = 0x03BF; break; //GREEK SMALL LETTER OMICRON
			case 0xF0: code = 0x03C0; break; //GREEK SMALL LETTER PI
			case 0xF1: code = 0x03C1; break; //GREEK SMALL LETTER RHO
			case 0xF2: code = 0x03C2; break; //GREEK SMALL LETTER FINAL SIGMA
			case 0xF3: code = 0x03C3; break; //GREEK SMALL LETTER SIGMA
			case 0xF4: code = 0x03C4; break; //GREEK SMALL LETTER TAU
			case 0xF5: code = 0x03C5; break; //GREEK SMALL LETTER UPSILON
			case 0xF6: code = 0x03C6; break; //GREEK SMALL LETTER PHI
			case 0xF7: code = 0x03C7; break; //GREEK SMALL LETTER CHI
			case 0xF8: code = 0x03C8; break; //GREEK SMALL LETTER PSI
			case 0xF9: code = 0x03C9; break; //GREEK SMALL LETTER OMEGA
			case 0xFA: code = 0x03CA; break; //GREEK SMALL LETTER IOTA WITH DIALYTIKA
			case 0xFB: code = 0x03CB; break; //GREEK SMALL LETTER UPSILON WITH DIALYTIKA
			case 0xFC: code = 0x03CC; break; //GREEK SMALL LETTER OMICRON WITH TONOS
			case 0xFD: code = 0x03CD; break; //GREEK SMALL LETTER UPSILON WITH TONOS
			case 0xFE: code = 0x03CE; break; //GREEK SMALL LETTER OMEGA WITH TONOS
		}
		//Pushing the translated code
		byteBuf.push(code);
	}
	return {
		dropped: 0,
		data: byteBuf
	};
}