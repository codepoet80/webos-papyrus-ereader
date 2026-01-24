/*
 * Inflater  -  a javascript inflate class
 *
 * Based on tInflate (Copyright (c) 2003 by Joergen Ibsen / Jibz)
 * http://www.ibsensoftware.com/download.html
 */

//Return codes
var JSINF_OK = 0
var JSINF_DATA_ERROR = (-3);
 
/* ------------------------------ *
 * -- internal data structures -- *
 * ------------------------------ */

function InfTree() {
    this.table = new Array(); /* table of code length counts */
    this.trans = new Array(); /* code -> symbol translation table */
}

function InfData() {
    this.source = new Array(); //The source data byte-array
    this.sourcePos = 0;
    this.tag = 0;
    this.bitcount = 0;
    
    this.dest = new Array(); //The output byte-array
    
    this.ltree = new InfTree(); //The dynamic length/symbol tree
    this.dtree = new InfTree(); //The dynamic distance tree
}


/* --------------------------------------------------- *
 * -- uninitialized global data (static structures) -- *
 * --------------------------------------------------- */

//A flag telling whether or not the globals of the Inflater are initialized
Inflate.isInitialized = false; 

Inflate.sltree = new InfTree(); /* fixed length/symbol tree */
Inflate.sdtree = new InfTree(); /* fixed distance tree */

/* extra bits and base tables for length codes */
Inflate.length_bits = new Array();
Inflate.length_base = new Array();

/* extra bits and base tables for distance codes */
Inflate.dist_bits = new Array();
Inflate.dist_base = new Array();

/* special ordering of code length codes */
Inflate.clcidx = new Array(
   16, 17, 18, 0, 8, 7, 9, 6,
   10, 5, 11, 4, 12, 3, 13, 2,
   14, 1, 15
);

/* ----------------------- *
 * -- utility functions -- *
 * ----------------------- */

/* build extra bits and base tables */
Inflate.build_bits_base = function(bits, base, delta, first) {
   var i;
   var sum;

   /* build bits table */
   for (i = 0; i < delta; i += 1) { bits[i] = 0; }
   for (i = 0; i < 30 - delta; i += 1) { bits[i + delta] = Math.floor(i / delta); }

   /* build base table */
   for (sum = first, i = 0; i < 30; i += 1) {
      base[i] = sum;
      sum += 1 << bits[i];
   }
}

/* build the fixed huffman trees */
Inflate.prototype.build_fixed_trees = function(lt, dt) {
   var i;

   /* build fixed length tree */
   for (i = 0; i < 7; i += 1) { lt.table[i] = 0; }

   lt.table[7] = 24;
   lt.table[8] = 152;
   lt.table[9] = 112;

   for (i = 0; i < 24; i += 1) lt.trans[i] = 256 + i;
   for (i = 0; i < 144; i += 1) lt.trans[24 + i] = i;
   for (i = 0; i < 8; i += 1) lt.trans[24 + 144 + i] = 280 + i;
   for (i = 0; i < 112; i += 1) lt.trans[24 + 144 + 8 + i] = 144 + i;

   /* build fixed distance tree */
   for (i = 0; i < 5; i += 1) dt.table[i] = 0;

   dt.table[5] = 32;

   for (i = 0; i < 32; i += 1) dt.trans[i] = i;
}

/* given an array of code lengths, build a tree */
Inflate.prototype.build_tree = function(t, lengths, num) {
   var offs = new Array(16);
   var i; var sum;

   /* clear code length count table */
   for (i = 0; i < 16; i += 1) { t.table[i] = 0; }

   /* scan symbol lengths, and sum code length counts */
   for (i = 0; i < num; i += 1) {
       t.table[lengths[i]] += 1;
   };

   t.table[0] = 0;

   /* compute offset table for distribution sort */
   for (sum = 0, i = 0; i < 16; i += 1) {
      offs[i] = sum;
      sum += t.table[i];
   }

   /* create code->symbol translation table (symbols sorted by code) */
   for (i = 0; i < num; i += 1) {
       if (lengths[i]) {
           t.trans[offs[lengths[i]]] = i;
           offs[lengths[i]] += 1;
       }
   }
}

/* ---------------------- *
 * -- decode functions -- *
 * ---------------------- */

/* get one bit from source stream */
Inflate.prototype.getbit = function(d) {
   var bit;
   
   if (d.sourcePos > d.source.length) {
       console.error("Premature end on inflating.");
       return undefined;
   }
   
   /* check if tag is empty */
   if (d.bitcount == 0) {
      /* load next tag */
      d.tag = d.source[d.sourcePos];
      d.sourcePos += 1;
      d.bitcount = 7;
   } else {
       d.bitcount -= 1;
   }

   /* shift bit out of tag */
   bit = d.tag & 0x01;
   d.tag = d.tag >> 1;

   return bit;
}

/* read a num bit value from a stream and add base */
Inflate.prototype.read_bits = function(d, num, base) {
   var val = 0;

   /* read num bits */
   if (num) {
      var limit = 1 << (num);
      var mask;
      for (mask = 1; mask < limit; mask *= 2) {
          if (this.getbit(d)) { val += mask; }
      }
   }

   return val + base;
}

/* given a data stream and a tree, decode a symbol */
Inflate.prototype.decode_symbol = function(d, t) {
   var sum = 0; var cur = 0; var len = 0;

   /* get more bits while code value is above sum */
   do {
      cur = 2 * cur + this.getbit(d);

      len += 1;

      sum += t.table[len];
      cur -= t.table[len];

   } while (cur >= 0);

   return t.trans[sum + cur];
}

/* given a data stream, decode dynamic trees from it */
Inflate.prototype.decode_trees = function(d, lt, dt) {
   var code_tree = new InfTree();
   var lengths = new Array(288+32);
   var hlit; var hdist; var hclen;
   var i; var num; var length;

   /* get 5 bits HLIT (257-286) */
   hlit = this.read_bits(d, 5, 257);

   /* get 5 bits HDIST (1-32) */
   hdist = this.read_bits(d, 5, 1);

   /* get 4 bits HCLEN (4-19) */
   hclen = this.read_bits(d, 4, 4);

   for (i = 0; i < 19; i += 1) { lengths[i] = 0; }

   /* read code lengths for code length alphabet */
   for (i = 0; i < hclen; i += 1) {
      /* get 3 bits code length (0-7) */
      var clen = this.read_bits(d, 3, 0);

      lengths[Inflate.clcidx[i]] = clen;
   }

   /* build code length tree */
   this.build_tree(code_tree, lengths, 19);

   /* decode code lengths for the dynamic trees */
   for (num = 0; num < hlit + hdist; ) {
      var sym = this.decode_symbol(d, code_tree);

      switch (sym) {
          case 16:
             /* copy previous code length 3-6 times (read 2 bits) */
             var prev = lengths[num - 1];
             for (length = this.read_bits(d, 2, 3); length; length -= 1) {
                lengths[num] = prev;
                num += 1;
             }
             break;
          case 17:
             /* repeat code length 0 for 3-10 times (read 3 bits) */
             for (length = this.read_bits(d, 3, 3); length; length -= 1) {
                lengths[num] = 0;
                num += 1;
             }
             break;
          case 18:
             /* repeat code length 0 for 11-138 times (read 7 bits) */
             for (length = this.read_bits(d, 7, 11); length; length -= 1) {
                lengths[num] = 0;
                num += 1;
             }
             break;
          default:
             /* values 0-15 represent the actual code lengths */
             lengths[num] = sym;
             num += 1;
             break;
      }
   }

   /* build dynamic trees */
   //The len-tree uses the first hlit data points from "lengths"
   this.build_tree(lt, lengths, hlit);
   //The dist-tree uses the remaining data points from "lengths"
   for (i = 0; i < hlit; i += 1) { lengths.shift(); }
   this.build_tree(dt, lengths, hdist);
}

/* ----------------------------- *
 * -- block inflate functions -- *
 * ----------------------------- */

/* given a stream and two trees, inflate a block of data */
Inflate.prototype.inflate_block_data = function(d, lt, dt) {
   while (true) {
      var sym = this.decode_symbol(d, lt);

      /* check for end of block */
      if (sym == 256) {
         return JSINF_OK;
      }

      if (sym < 256){
         //Direct copy
         d.dest.push(sym);
      } else {
         var length; var dist; var offs;
         var i;

         sym -= 257;

         /* possibly get more bits from length code */
         length = this.read_bits(d, Inflate.length_bits[sym], Inflate.length_base[sym]);

         dist = this.decode_symbol(d, dt);

         /* possibly get more bits from distance code */
         offs = this.read_bits(d, Inflate.dist_bits[dist], Inflate.dist_base[dist]);

         /* copy match */
         for (i = 0; i < length; i += 1) {
            var chr = d.dest[d.dest.length - offs];
            d.dest.push(chr);
         }
      }
   }
}

/* inflate an uncompressed block of data */
Inflate.prototype.inflate_uncompressed_block = function(d) {
   var length; var invlength;
   var i;

   /* get length */
   length = d.source[d.sourcePos + 1];
   length = 256 * length + d.source[d.sourcePos];

   /* get one's complement of length */
   invlength = d.source[d.sourcePos + 3];
   invlength = 256 * invlength + d.source[d.sourcePos + 2];

   /* check length */
   if (length != (~invlength & 0x0000ffff)) return JSINF_DATA_ERROR;

   d.sourcePos += 4;

   /* copy block */
   for (i = length; i; i -= 1) {
       d.dest.push(d.source[d.sourcePos]);
       d.sourcePos += 1;
   }

   /* make sure we start next block on a byte boundary */
   d.bitcount = 0;

   return JSINF_OK;
}

/* inflate a block of data compressed with fixed huffman trees */
Inflate.prototype.inflate_fixed_block = function(d) {
   /* decode block using fixed trees */
   return this.inflate_block_data(d, Inflate.sltree, Inflate.sdtree);
}

/* inflate a block of data compressed with dynamic huffman trees */
Inflate.prototype.inflate_dynamic_block = function(d) {
   /* decode trees from stream */
   this.decode_trees(d, d.ltree, d.dtree);

   /* decode block using decoded trees */
   return this.inflate_block_data(d, d.ltree, d.dtree);
}

/* ---------------------- *
 * -- public functions -- *
 * ---------------------- */

/**
 * Creates a new Zlib Inflater.
 */
function Inflate() {
   /* build fixed huffman trees */
	if (Inflate.isInitialized == false) {
		this.build_fixed_trees(Inflate.sltree, Inflate.sdtree);
		/* build extra bits and base tables */
		Inflate.build_bits_base(Inflate.length_bits, Inflate.length_base, 4, 3);
		Inflate.build_bits_base(Inflate.dist_bits, Inflate.dist_base, 2, 1);
		
		/* fix a special case */
		Inflate.length_bits[28] = 0;
		Inflate.length_base[28] = 258;
		
		Inflate.isInitialized = true;
	}
}

/**
 * Inflates the given source array to the dest array 
 * @param {Object} dest an empty array of bytes where the decompressed data is funneled into. 
 * @param {Object} source an array of bytes that encode the compressed stream.
 * @param {Boolean} isGzip whether or not the stream has a gzip header/footer
 * @return JSINF_OK if the decompression was successful, JSINF_DATA_ERROR otherwise.
 */
Inflate.prototype.uncompress = function(dest, source, isGzip) {
	var d = new InfData();
	var bfinal;
	
	/* initialise data */
	if (isGzip) {
		//We strip the 10-byte gzip header and 8 byte footer
		d.source = source.slice(10, source.length - 8);		
	} else {
		d.source = source;
	}
	d.bitcount = 0;
	
	d.dest = dest;
	
	do {
		var btype;
		var res;
		
		// read final block flag
		bfinal = this.getbit(d);
		
		// read block type (2 bits)
		btype = this.read_bits(d, 2, 0);
		
		// decompress block
		switch (btype) {
		case 0:
			// decompress uncompressed block
			res = this.inflate_uncompressed_block(d);
			break;
		case 1:
		 	// decompress block with fixed huffman trees
		 	res = this.inflate_fixed_block(d);
		 	break;
		case 2:
			// decompress block with dynamic huffman trees
			res = this.inflate_dynamic_block(d);
			break;
		default:
			return JSINF_DATA_ERROR;
		}
		
		if (res != JSINF_OK) return JSINF_DATA_ERROR;

	} while (!bfinal);
	
	return JSINF_OK;
}

/**
 * The same as regular uncompress, only that it's asynchronous and the dest
 * array is created automatically. 
 *  
 * @param {Object} source an array of bytes that encode the compressed stream.
 * @param {Boolean} isGzip whether or not the stream has a gzip header/footer
 * @param {function} callback the function to call with the dest buffer after
 * 		decompression. 
 */
Inflate.prototype.uncompressAsync = function(source, isGzip, callback) {
	var d = new InfData();
	
	/* initialise data */
	if (isGzip) {
		//We strip the 10-byte gzip header and 8 byte footer
		d.source = source.slice(10, source.length - 8);		
	} else {
		d.source = source;
	}
	d.bitcount = 0;
	
	d.dest = new Array();
	
	//Asynchronously decompresses one block at a time
	var decWorker = function(d, self, callback) {
		var res;
		// read final block flag
		var bfinal = this.getbit(d);
		// read block type (2 bits)
		var btype = this.read_bits(d, 2, 0);
		// decompress block
		switch (btype) {
			case 0:
				// decompress uncompressed block
				res = this.inflate_uncompressed_block(d);
				break;
			case 1:
			 	// decompress block with fixed huffman trees
			 	res = this.inflate_fixed_block(d);
			 	break;
			case 2:
				// decompress block with dynamic huffman trees
				res = this.inflate_dynamic_block(d);
				break;
			default:
				callback(null);
				return;
		}
		
		if (res != JSINF_OK) {
			callback(null);
			return;
		}
		//Checking if we're done
		if (!bfinal) {
			//Calling self deferred again
			self.bind(this, d, self, callback).defer();
		} else {
			//Finished decompression
			callback(d.dest);
		}
	}
	
	//Calling the decompression worker (deferred)
	decWorker.bind(this, d, decWorker, callback).defer();
	
}
