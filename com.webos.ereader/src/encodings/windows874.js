/**
 * Translates an array of bytes from Windows-874 to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateWindows874(bytes) {
	var byteBuf = new Array();
	for (var i = 0; i < bytes.length; i+=1) {
		var code = bytes[i];
		switch (bytes[i]) {
			case 0x80: code = 0x20AC; break; //EURO SIGN
			case 0x85: code = 0x2026; break; //HORIZONTAL ELLIPSIS
			case 0x91: code = 0x2018; break; //LEFT SINGLE QUOTATION MARK
			case 0x92: code = 0x2019; break; //RIGHT SINGLE QUOTATION MARK
			case 0x93: code = 0x201C; break; //LEFT DOUBLE QUOTATION MARK
			case 0x94: code = 0x201D; break; //RIGHT DOUBLE QUOTATION MARK
			case 0x95: code = 0x2022; break; //BULLET
			case 0x96: code = 0x2013; break; //EN DASH
			case 0x97: code = 0x2014; break; //EM DASH
			case 0xA0: code = 0x00A0; break; //NO-BREAK SPACE
			case 0xA1: code = 0x0E01; break; //THAI CHARACTER KO KAI
			case 0xA2: code = 0x0E02; break; //THAI CHARACTER KHO KHAI
			case 0xA3: code = 0x0E03; break; //THAI CHARACTER KHO KHUAT
			case 0xA4: code = 0x0E04; break; //THAI CHARACTER KHO KHWAI
			case 0xA5: code = 0x0E05; break; //THAI CHARACTER KHO KHON
			case 0xA6: code = 0x0E06; break; //THAI CHARACTER KHO RAKHANG
			case 0xA7: code = 0x0E07; break; //THAI CHARACTER NGO NGU
			case 0xA8: code = 0x0E08; break; //THAI CHARACTER CHO CHAN
			case 0xA9: code = 0x0E09; break; //THAI CHARACTER CHO CHING
			case 0xAA: code = 0x0E0A; break; //THAI CHARACTER CHO CHANG
			case 0xAB: code = 0x0E0B; break; //THAI CHARACTER SO SO
			case 0xAC: code = 0x0E0C; break; //THAI CHARACTER CHO CHOE
			case 0xAD: code = 0x0E0D; break; //THAI CHARACTER YO YING
			case 0xAE: code = 0x0E0E; break; //THAI CHARACTER DO CHADA
			case 0xAF: code = 0x0E0F; break; //THAI CHARACTER TO PATAK
			case 0xB0: code = 0x0E10; break; //THAI CHARACTER THO THAN
			case 0xB1: code = 0x0E11; break; //THAI CHARACTER THO NANGMONTHO
			case 0xB2: code = 0x0E12; break; //THAI CHARACTER THO PHUTHAO
			case 0xB3: code = 0x0E13; break; //THAI CHARACTER NO NEN
			case 0xB4: code = 0x0E14; break; //THAI CHARACTER DO DEK
			case 0xB5: code = 0x0E15; break; //THAI CHARACTER TO TAO
			case 0xB6: code = 0x0E16; break; //THAI CHARACTER THO THUNG
			case 0xB7: code = 0x0E17; break; //THAI CHARACTER THO THAHAN
			case 0xB8: code = 0x0E18; break; //THAI CHARACTER THO THONG
			case 0xB9: code = 0x0E19; break; //THAI CHARACTER NO NU
			case 0xBA: code = 0x0E1A; break; //THAI CHARACTER BO BAIMAI
			case 0xBB: code = 0x0E1B; break; //THAI CHARACTER PO PLA
			case 0xBC: code = 0x0E1C; break; //THAI CHARACTER PHO PHUNG
			case 0xBD: code = 0x0E1D; break; //THAI CHARACTER FO FA
			case 0xBE: code = 0x0E1E; break; //THAI CHARACTER PHO PHAN
			case 0xBF: code = 0x0E1F; break; //THAI CHARACTER FO FAN
			case 0xC0: code = 0x0E20; break; //THAI CHARACTER PHO SAMPHAO
			case 0xC1: code = 0x0E21; break; //THAI CHARACTER MO MA
			case 0xC2: code = 0x0E22; break; //THAI CHARACTER YO YAK
			case 0xC3: code = 0x0E23; break; //THAI CHARACTER RO RUA
			case 0xC4: code = 0x0E24; break; //THAI CHARACTER RU
			case 0xC5: code = 0x0E25; break; //THAI CHARACTER LO LING
			case 0xC6: code = 0x0E26; break; //THAI CHARACTER LU
			case 0xC7: code = 0x0E27; break; //THAI CHARACTER WO WAEN
			case 0xC8: code = 0x0E28; break; //THAI CHARACTER SO SALA
			case 0xC9: code = 0x0E29; break; //THAI CHARACTER SO RUSI
			case 0xCA: code = 0x0E2A; break; //THAI CHARACTER SO SUA
			case 0xCB: code = 0x0E2B; break; //THAI CHARACTER HO HIP
			case 0xCC: code = 0x0E2C; break; //THAI CHARACTER LO CHULA
			case 0xCD: code = 0x0E2D; break; //THAI CHARACTER O ANG
			case 0xCE: code = 0x0E2E; break; //THAI CHARACTER HO NOKHUK
			case 0xCF: code = 0x0E2F; break; //THAI CHARACTER PAIYANNOI
			case 0xD0: code = 0x0E30; break; //THAI CHARACTER SARA A
			case 0xD1: code = 0x0E31; break; //THAI CHARACTER MAI HAN-AKAT
			case 0xD2: code = 0x0E32; break; //THAI CHARACTER SARA AA
			case 0xD3: code = 0x0E33; break; //THAI CHARACTER SARA AM
			case 0xD4: code = 0x0E34; break; //THAI CHARACTER SARA I
			case 0xD5: code = 0x0E35; break; //THAI CHARACTER SARA II
			case 0xD6: code = 0x0E36; break; //THAI CHARACTER SARA UE
			case 0xD7: code = 0x0E37; break; //THAI CHARACTER SARA UEE
			case 0xD8: code = 0x0E38; break; //THAI CHARACTER SARA U
			case 0xD9: code = 0x0E39; break; //THAI CHARACTER SARA UU
			case 0xDA: code = 0x0E3A; break; //THAI CHARACTER PHINTHU
			case 0xDF: code = 0x0E3F; break; //THAI CURRENCY SYMBOL BAHT
			case 0xE0: code = 0x0E40; break; //THAI CHARACTER SARA E
			case 0xE1: code = 0x0E41; break; //THAI CHARACTER SARA AE
			case 0xE2: code = 0x0E42; break; //THAI CHARACTER SARA O
			case 0xE3: code = 0x0E43; break; //THAI CHARACTER SARA AI MAIMUAN
			case 0xE4: code = 0x0E44; break; //THAI CHARACTER SARA AI MAIMALAI
			case 0xE5: code = 0x0E45; break; //THAI CHARACTER LAKKHANGYAO
			case 0xE6: code = 0x0E46; break; //THAI CHARACTER MAIYAMOK
			case 0xE7: code = 0x0E47; break; //THAI CHARACTER MAITAIKHU
			case 0xE8: code = 0x0E48; break; //THAI CHARACTER MAI EK
			case 0xE9: code = 0x0E49; break; //THAI CHARACTER MAI THO
			case 0xEA: code = 0x0E4A; break; //THAI CHARACTER MAI TRI
			case 0xEB: code = 0x0E4B; break; //THAI CHARACTER MAI CHATTAWA
			case 0xEC: code = 0x0E4C; break; //THAI CHARACTER THANTHAKHAT
			case 0xED: code = 0x0E4D; break; //THAI CHARACTER NIKHAHIT
			case 0xEE: code = 0x0E4E; break; //THAI CHARACTER YAMAKKAN
			case 0xEF: code = 0x0E4F; break; //THAI CHARACTER FONGMAN
			case 0xF0: code = 0x0E50; break; //THAI DIGIT ZERO
			case 0xF1: code = 0x0E51; break; //THAI DIGIT ONE
			case 0xF2: code = 0x0E52; break; //THAI DIGIT TWO
			case 0xF3: code = 0x0E53; break; //THAI DIGIT THREE
			case 0xF4: code = 0x0E54; break; //THAI DIGIT FOUR
			case 0xF5: code = 0x0E55; break; //THAI DIGIT FIVE
			case 0xF6: code = 0x0E56; break; //THAI DIGIT SIX
			case 0xF7: code = 0x0E57; break; //THAI DIGIT SEVEN
			case 0xF8: code = 0x0E58; break; //THAI DIGIT EIGHT
			case 0xF9: code = 0x0E59; break; //THAI DIGIT NINE
			case 0xFA: code = 0x0E5A; break; //THAI CHARACTER ANGKHANKHU
			case 0xFB: code = 0x0E5B; break; //THAI CHARACTER KHOMUT
		}
		//Pushing the translated code
		byteBuf.push(code);
	}
	return {
		dropped: 0,
		data: byteBuf
	};
}