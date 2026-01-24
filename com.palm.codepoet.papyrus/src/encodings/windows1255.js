/**
 * Translates an array of bytes from Windows-1255 to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateWindows1255(bytes) {
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
			case 0x88: code = 0x02C6; break; //MODIFIER LETTER CIRCUMFLEX ACCENT
			case 0x89: code = 0x2030; break; //PER MILLE SIGN
			case 0x8B: code = 0x2039; break; //SINGLE LEFT-POINTING ANGLE QUOTATION MARK
			case 0x91: code = 0x2018; break; //LEFT SINGLE QUOTATION MARK
			case 0x92: code = 0x2019; break; //RIGHT SINGLE QUOTATION MARK
			case 0x93: code = 0x201C; break; //LEFT DOUBLE QUOTATION MARK
			case 0x94: code = 0x201D; break; //RIGHT DOUBLE QUOTATION MARK
			case 0x95: code = 0x2022; break; //BULLET
			case 0x96: code = 0x2013; break; //EN DASH
			case 0x97: code = 0x2014; break; //EM DASH
			case 0x98: code = 0x02DC; break; //SMALL TILDE
			case 0x99: code = 0x2122; break; //TRADE MARK SIGN
			case 0x9B: code = 0x203A; break; //SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
			case 0xA0: code = 0x00A0; break; //NO-BREAK SPACE
			case 0xA1: code = 0x00A1; break; //INVERTED EXCLAMATION MARK
			case 0xA2: code = 0x00A2; break; //CENT SIGN
			case 0xA3: code = 0x00A3; break; //POUND SIGN
			case 0xA4: code = 0x20AA; break; //NEW SHEQEL SIGN
			case 0xA5: code = 0x00A5; break; //YEN SIGN
			case 0xA6: code = 0x00A6; break; //BROKEN BAR
			case 0xA7: code = 0x00A7; break; //SECTION SIGN
			case 0xA8: code = 0x00A8; break; //DIAERESIS
			case 0xA9: code = 0x00A9; break; //COPYRIGHT SIGN
			case 0xAA: code = 0x00D7; break; //MULTIPLICATION SIGN
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
			case 0xBA: code = 0x00F7; break; //DIVISION SIGN
			case 0xBB: code = 0x00BB; break; //RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
			case 0xBC: code = 0x00BC; break; //VULGAR FRACTION ONE QUARTER
			case 0xBD: code = 0x00BD; break; //VULGAR FRACTION ONE HALF
			case 0xBE: code = 0x00BE; break; //VULGAR FRACTION THREE QUARTERS
			case 0xBF: code = 0x00BF; break; //INVERTED QUESTION MARK
			case 0xC0: code = 0x05B0; break; //HEBREW POINT SHEVA
			case 0xC1: code = 0x05B1; break; //HEBREW POINT HATAF SEGOL
			case 0xC2: code = 0x05B2; break; //HEBREW POINT HATAF PATAH
			case 0xC3: code = 0x05B3; break; //HEBREW POINT HATAF QAMATS
			case 0xC4: code = 0x05B4; break; //HEBREW POINT HIRIQ
			case 0xC5: code = 0x05B5; break; //HEBREW POINT TSERE
			case 0xC6: code = 0x05B6; break; //HEBREW POINT SEGOL
			case 0xC7: code = 0x05B7; break; //HEBREW POINT PATAH
			case 0xC8: code = 0x05B8; break; //HEBREW POINT QAMATS
			case 0xC9: code = 0x05B9; break; //HEBREW POINT HOLAM
			case 0xCB: code = 0x05BB; break; //HEBREW POINT QUBUTS
			case 0xCC: code = 0x05BC; break; //HEBREW POINT DAGESH OR MAPIQ
			case 0xCD: code = 0x05BD; break; //HEBREW POINT METEG
			case 0xCE: code = 0x05BE; break; //HEBREW PUNCTUATION MAQAF
			case 0xCF: code = 0x05BF; break; //HEBREW POINT RAFE
			case 0xD0: code = 0x05C0; break; //HEBREW PUNCTUATION PASEQ
			case 0xD1: code = 0x05C1; break; //HEBREW POINT SHIN DOT
			case 0xD2: code = 0x05C2; break; //HEBREW POINT SIN DOT
			case 0xD3: code = 0x05C3; break; //HEBREW PUNCTUATION SOF PASUQ
			case 0xD4: code = 0x05F0; break; //HEBREW LIGATURE YIDDISH DOUBLE VAV
			case 0xD5: code = 0x05F1; break; //HEBREW LIGATURE YIDDISH VAV YOD
			case 0xD6: code = 0x05F2; break; //HEBREW LIGATURE YIDDISH DOUBLE YOD
			case 0xD7: code = 0x05F3; break; //HEBREW PUNCTUATION GERESH
			case 0xD8: code = 0x05F4; break; //HEBREW PUNCTUATION GERSHAYIM
			case 0xE0: code = 0x05D0; break; //HEBREW LETTER ALEF
			case 0xE1: code = 0x05D1; break; //HEBREW LETTER BET
			case 0xE2: code = 0x05D2; break; //HEBREW LETTER GIMEL
			case 0xE3: code = 0x05D3; break; //HEBREW LETTER DALET
			case 0xE4: code = 0x05D4; break; //HEBREW LETTER HE
			case 0xE5: code = 0x05D5; break; //HEBREW LETTER VAV
			case 0xE6: code = 0x05D6; break; //HEBREW LETTER ZAYIN
			case 0xE7: code = 0x05D7; break; //HEBREW LETTER HET
			case 0xE8: code = 0x05D8; break; //HEBREW LETTER TET
			case 0xE9: code = 0x05D9; break; //HEBREW LETTER YOD
			case 0xEA: code = 0x05DA; break; //HEBREW LETTER FINAL KAF
			case 0xEB: code = 0x05DB; break; //HEBREW LETTER KAF
			case 0xEC: code = 0x05DC; break; //HEBREW LETTER LAMED
			case 0xED: code = 0x05DD; break; //HEBREW LETTER FINAL MEM
			case 0xEE: code = 0x05DE; break; //HEBREW LETTER MEM
			case 0xEF: code = 0x05DF; break; //HEBREW LETTER FINAL NUN
			case 0xF0: code = 0x05E0; break; //HEBREW LETTER NUN
			case 0xF1: code = 0x05E1; break; //HEBREW LETTER SAMEKH
			case 0xF2: code = 0x05E2; break; //HEBREW LETTER AYIN
			case 0xF3: code = 0x05E3; break; //HEBREW LETTER FINAL PE
			case 0xF4: code = 0x05E4; break; //HEBREW LETTER PE
			case 0xF5: code = 0x05E5; break; //HEBREW LETTER FINAL TSADI
			case 0xF6: code = 0x05E6; break; //HEBREW LETTER TSADI
			case 0xF7: code = 0x05E7; break; //HEBREW LETTER QOF
			case 0xF8: code = 0x05E8; break; //HEBREW LETTER RESH
			case 0xF9: code = 0x05E9; break; //HEBREW LETTER SHIN
			case 0xFA: code = 0x05EA; break; //HEBREW LETTER TAV
			case 0xFD: code = 0x200E; break; //LEFT-TO-RIGHT MARK
			case 0xFE: code = 0x200F; break; //RIGHT-TO-LEFT MARK
		}
		//Pushing the translated code
		byteBuf.push(code);
	}
	return {
		dropped: 0,
		data: byteBuf
	};
}
