// javascript implementation of pukall cipher 1 (128 bit key)
// for more information, see http://membres.lycos.fr/pc1/

function pc1(key, src, decrypt) {
	if (!src || !src.length || !key || key.length!=16) return [];
	decrypt = (typeof(decrypt)=="undefined")?true:decrypt;
	var dst = [], x1a0=[], ax = 0, cx = 0x015A, bx = 0x4E35, ca = 0x101;
	var x1a2 = 0, dx = 0, kx = 0, inter = 0, cfc = 0, cfd = 0, c = 0;

	var ct=8;
	do { 
		x1a0[--ct] = (key[ct*2]<<8 | key[ct*2+1]); 
	} while(ct);

    var sct = -1,sfin = src.length-1;
	do {
		ax = inter = 0;

		ct = -1;
		do {
			ax ^=  x1a0[++ct];
            x1a2  = (x1a2 + ct) * bx + dx;
            dx  = (ax * cx) & 0xFFFF;
            x1a2  = (x1a2 + dx) & 0xFFFF;
            ax = (ax * bx + 1) & 0xFFFF;
            inter ^= ax ^ x1a2;
		} while(ct < 7);

		c = src[++sct];
		cfc = inter >> 8;
		cfd = inter & 0xFF;

		ct = 8;
		if (!decrypt) { kx = c * ca; do { x1a0[--ct] ^= kx;} while(ct); }
		c = c ^ (cfc^cfd);
		if (decrypt) { kx = c * ca; do { x1a0[--ct] ^= kx;} while(ct); }

        dst[sct] = c;
	} while(sct<sfin);
    return dst;
}