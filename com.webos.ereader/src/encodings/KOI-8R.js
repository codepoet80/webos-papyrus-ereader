/**
 * Translates an array of bytes from KOI-8R to HTML Unicode escapes
 * @param {Object} bytes the array of bytes to convert.
 */
function translateKOI8R(bytes) {
	var byteBuf = new Array();
	for (var i = 0; i < bytes.length; i+=1) {
		var code = bytes[i];
		switch (bytes[i]) {
			case 0x80: code = 0x2500; break; //BOX DRAWINGS LIGHT HORIZONTAL
			case 0x81: code = 0x2502; break; //BOX DRAWINGS LIGHT VERTICAL
			case 0x82: code = 0x250C; break; //BOX DRAWINGS LIGHT DOWN AND RIGHT
			case 0x83: code = 0x2510; break; //BOX DRAWINGS LIGHT DOWN AND LEFT
			case 0x84: code = 0x2514; break; //BOX DRAWINGS LIGHT UP AND RIGHT
			case 0x85: code = 0x2518; break; //BOX DRAWINGS LIGHT UP AND LEFT
			case 0x86: code = 0x251C; break; //BOX DRAWINGS LIGHT VERTICAL AND RIGHT
			case 0x87: code = 0x2524; break; //BOX DRAWINGS LIGHT VERTICAL AND LEFT
			case 0x88: code = 0x252C; break; //BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
			case 0x89: code = 0x2534; break; //BOX DRAWINGS LIGHT UP AND HORIZONTAL
			case 0x8A: code = 0x253C; break; //BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
			case 0x8B: code = 0x2580; break; //UPPER HALF BLOCK
			case 0x8C: code = 0x2584; break; //LOWER HALF BLOCK
			case 0x8D: code = 0x2588; break; //FULL BLOCK
			case 0x8E: code = 0x258C; break; //LEFT HALF BLOCK
			case 0x8F: code = 0x2590; break; //RIGHT HALF BLOCK
			case 0x90: code = 0x2591; break; //LIGHT SHADE
			case 0x91: code = 0x2592; break; //MEDIUM SHADE
			case 0x92: code = 0x2593; break; //DARK SHADE
			case 0x93: code = 0x2320; break; //TOP HALF INTEGRAL
			case 0x94: code = 0x25A0; break; //BLACK SQUARE
			case 0x95: code = 0x2219; break; //BULLET OPERATOR
			case 0x96: code = 0x221A; break; //SQUARE ROOT
			case 0x97: code = 0x2248; break; //ALMOST EQUAL TO
			case 0x98: code = 0x2264; break; //LESS-THAN OR EQUAL TO
			case 0x99: code = 0x2265; break; //GREATER-THAN OR EQUAL TO
			case 0x9A: code = 0x00A0; break; //NO-BREAK SPACE
			case 0x9B: code = 0x2321; break; //BOTTOM HALF INTEGRAL
			case 0x9C: code = 0x00B0; break; //DEGREE SIGN
			case 0x9D: code = 0x00B2; break; //SUPERSCRIPT TWO
			case 0x9E: code = 0x00B7; break; //MIDDLE DOT
			case 0x9F: code = 0x00F7; break; //DIVISION SIGN
			case 0xA0: code = 0x2550; break; //BOX DRAWINGS DOUBLE HORIZONTAL
			case 0xA1: code = 0x2551; break; //BOX DRAWINGS DOUBLE VERTICAL
			case 0xA2: code = 0x2552; break; //BOX DRAWINGS DOWN SINGLE AND RIGHT DOUBLE
			case 0xA3: code = 0x0451; break; //CYRILLIC SMALL LETTER IO
			case 0xA4: code = 0x2553; break; //BOX DRAWINGS DOWN DOUBLE AND RIGHT SINGLE
			case 0xA5: code = 0x2554; break; //BOX DRAWINGS DOUBLE DOWN AND RIGHT
			case 0xA6: code = 0x2555; break; //BOX DRAWINGS DOWN SINGLE AND LEFT DOUBLE
			case 0xA7: code = 0x2556; break; //BOX DRAWINGS DOWN DOUBLE AND LEFT SINGLE
			case 0xA8: code = 0x2557; break; //BOX DRAWINGS DOUBLE DOWN AND LEFT
			case 0xA9: code = 0x2558; break; //BOX DRAWINGS UP SINGLE AND RIGHT DOUBLE
			case 0xAA: code = 0x2559; break; //BOX DRAWINGS UP DOUBLE AND RIGHT SINGLE
			case 0xAB: code = 0x255A; break; //BOX DRAWINGS DOUBLE UP AND RIGHT
			case 0xAC: code = 0x255B; break; //BOX DRAWINGS UP SINGLE AND LEFT DOUBLE
			case 0xAD: code = 0x255C; break; //BOX DRAWINGS UP DOUBLE AND LEFT SINGLE
			case 0xAE: code = 0x255D; break; //BOX DRAWINGS DOUBLE UP AND LEFT
			case 0xAF: code = 0x255E; break; //BOX DRAWINGS VERTICAL SINGLE AND RIGHT DOUBLE
			case 0xB0: code = 0x255F; break; //BOX DRAWINGS VERTICAL DOUBLE AND RIGHT SINGLE
			case 0xB1: code = 0x2560; break; //BOX DRAWINGS DOUBLE VERTICAL AND RIGHT
			case 0xB2: code = 0x2561; break; //BOX DRAWINGS VERTICAL SINGLE AND LEFT DOUBLE
			case 0xB3: code = 0x0401; break; //CYRILLIC CAPITAL LETTER IO
			case 0xB4: code = 0x2562; break; //BOX DRAWINGS VERTICAL DOUBLE AND LEFT SINGLE
			case 0xB5: code = 0x2563; break; //BOX DRAWINGS DOUBLE VERTICAL AND LEFT
			case 0xB6: code = 0x2564; break; //BOX DRAWINGS DOWN SINGLE AND HORIZONTAL DOUBLE
			case 0xB7: code = 0x2565; break; //BOX DRAWINGS DOWN DOUBLE AND HORIZONTAL SINGLE
			case 0xB8: code = 0x2566; break; //BOX DRAWINGS DOUBLE DOWN AND HORIZONTAL
			case 0xB9: code = 0x2567; break; //BOX DRAWINGS UP SINGLE AND HORIZONTAL DOUBLE
			case 0xBA: code = 0x2568; break; //BOX DRAWINGS UP DOUBLE AND HORIZONTAL SINGLE
			case 0xBB: code = 0x2569; break; //BOX DRAWINGS DOUBLE UP AND HORIZONTAL
			case 0xBC: code = 0x256A; break; //BOX DRAWINGS VERTICAL SINGLE AND HORIZONTAL DOUBLE
			case 0xBD: code = 0x256B; break; //BOX DRAWINGS VERTICAL DOUBLE AND HORIZONTAL SINGLE
			case 0xBE: code = 0x256C; break; //BOX DRAWINGS DOUBLE VERTICAL AND HORIZONTAL
			case 0xBF: code = 0x00A9; break; //COPYRIGHT SIGN
			case 0xC0: code = 0x044E; break; //CYRILLIC SMALL LETTER YU
			case 0xC1: code = 0x0430; break; //CYRILLIC SMALL LETTER A
			case 0xC2: code = 0x0431; break; //CYRILLIC SMALL LETTER BE
			case 0xC3: code = 0x0446; break; //CYRILLIC SMALL LETTER TSE
			case 0xC4: code = 0x0434; break; //CYRILLIC SMALL LETTER DE
			case 0xC5: code = 0x0435; break; //CYRILLIC SMALL LETTER IE
			case 0xC6: code = 0x0444; break; //CYRILLIC SMALL LETTER EF
			case 0xC7: code = 0x0433; break; //CYRILLIC SMALL LETTER GHE
			case 0xC8: code = 0x0445; break; //CYRILLIC SMALL LETTER HA
			case 0xC9: code = 0x0438; break; //CYRILLIC SMALL LETTER I
			case 0xCA: code = 0x0439; break; //CYRILLIC SMALL LETTER SHORT I
			case 0xCB: code = 0x043A; break; //CYRILLIC SMALL LETTER KA
			case 0xCC: code = 0x043B; break; //CYRILLIC SMALL LETTER EL
			case 0xCD: code = 0x043C; break; //CYRILLIC SMALL LETTER EM
			case 0xCE: code = 0x043D; break; //CYRILLIC SMALL LETTER EN
			case 0xCF: code = 0x043E; break; //CYRILLIC SMALL LETTER O
			case 0xD0: code = 0x043F; break; //CYRILLIC SMALL LETTER PE
			case 0xD1: code = 0x044F; break; //CYRILLIC SMALL LETTER YA
			case 0xD2: code = 0x0440; break; //CYRILLIC SMALL LETTER ER
			case 0xD3: code = 0x0441; break; //CYRILLIC SMALL LETTER ES
			case 0xD4: code = 0x0442; break; //CYRILLIC SMALL LETTER TE
			case 0xD5: code = 0x0443; break; //CYRILLIC SMALL LETTER U
			case 0xD6: code = 0x0436; break; //CYRILLIC SMALL LETTER ZHE
			case 0xD7: code = 0x0432; break; //CYRILLIC SMALL LETTER VE
			case 0xD8: code = 0x044C; break; //CYRILLIC SMALL LETTER SOFT SIGN
			case 0xD9: code = 0x044B; break; //CYRILLIC SMALL LETTER YERU
			case 0xDA: code = 0x0437; break; //CYRILLIC SMALL LETTER ZE
			case 0xDB: code = 0x0448; break; //CYRILLIC SMALL LETTER SHA
			case 0xDC: code = 0x044D; break; //CYRILLIC SMALL LETTER E
			case 0xDD: code = 0x0449; break; //CYRILLIC SMALL LETTER SHCHA
			case 0xDE: code = 0x0447; break; //CYRILLIC SMALL LETTER CHE
			case 0xDF: code = 0x044A; break; //CYRILLIC SMALL LETTER HARD SIGN
			case 0xE0: code = 0x042E; break; //CYRILLIC CAPITAL LETTER YU
			case 0xE1: code = 0x0410; break; //CYRILLIC CAPITAL LETTER A
			case 0xE2: code = 0x0411; break; //CYRILLIC CAPITAL LETTER BE
			case 0xE3: code = 0x0426; break; //CYRILLIC CAPITAL LETTER TSE
			case 0xE4: code = 0x0414; break; //CYRILLIC CAPITAL LETTER DE
			case 0xE5: code = 0x0415; break; //CYRILLIC CAPITAL LETTER IE
			case 0xE6: code = 0x0424; break; //CYRILLIC CAPITAL LETTER EF
			case 0xE7: code = 0x0413; break; //CYRILLIC CAPITAL LETTER GHE
			case 0xE8: code = 0x0425; break; //CYRILLIC CAPITAL LETTER HA
			case 0xE9: code = 0x0418; break; //CYRILLIC CAPITAL LETTER I
			case 0xEA: code = 0x0419; break; //CYRILLIC CAPITAL LETTER SHORT I
			case 0xEB: code = 0x041A; break; //CYRILLIC CAPITAL LETTER KA
			case 0xEC: code = 0x041B; break; //CYRILLIC CAPITAL LETTER EL
			case 0xED: code = 0x041C; break; //CYRILLIC CAPITAL LETTER EM
			case 0xEE: code = 0x041D; break; //CYRILLIC CAPITAL LETTER EN
			case 0xEF: code = 0x041E; break; //CYRILLIC CAPITAL LETTER O
			case 0xF0: code = 0x041F; break; //CYRILLIC CAPITAL LETTER PE
			case 0xF1: code = 0x042F; break; //CYRILLIC CAPITAL LETTER YA
			case 0xF2: code = 0x0420; break; //CYRILLIC CAPITAL LETTER ER
			case 0xF3: code = 0x0421; break; //CYRILLIC CAPITAL LETTER ES
			case 0xF4: code = 0x0422; break; //CYRILLIC CAPITAL LETTER TE
			case 0xF5: code = 0x0423; break; //CYRILLIC CAPITAL LETTER U
			case 0xF6: code = 0x0416; break; //CYRILLIC CAPITAL LETTER ZHE
			case 0xF7: code = 0x0412; break; //CYRILLIC CAPITAL LETTER VE
			case 0xF8: code = 0x042C; break; //CYRILLIC CAPITAL LETTER SOFT SIGN
			case 0xF9: code = 0x042B; break; //CYRILLIC CAPITAL LETTER YERU
			case 0xFA: code = 0x0417; break; //CYRILLIC CAPITAL LETTER ZE
			case 0xFB: code = 0x0428; break; //CYRILLIC CAPITAL LETTER SHA
			case 0xFC: code = 0x042D; break; //CYRILLIC CAPITAL LETTER E
			case 0xFD: code = 0x0429; break; //CYRILLIC CAPITAL LETTER SHCHA
			case 0xFE: code = 0x0427; break; //CYRILLIC CAPITAL LETTER CHE
			case 0xFF: code = 0x042A; break; //CYRILLIC CAPITAL LETTER HARD SIGN
		}
		//Pushing the translated code
		byteBuf.push(code);
	}
	return {
		dropped: 0,
		data: byteBuf
	};
}