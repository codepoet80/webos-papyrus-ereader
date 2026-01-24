/*
 * $Id: rawdeflate.js,v 0.3 2009/03/01 19:05:05 dankogai Exp dankogai $
 *
 * Original:
 *   http://www.onicos.com/staff/iz/amuse/javascript/expert/deflate.txt
 *   
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0.1
 * LastModified: Dec 25 1999
 * 
 * Copyright (C) 2010 Martin Schröder <mschroed@informatik.hu-berlin.de>
 * Version: 1.0.2
 * LastModified: Feb 12 2010
 */

/**
 * Creates a new Deflating object. To compress a byte buffer,
 * call Deflate.compress(). After compression is completed, the
 * object can be reused again.
 * 
 */
function Deflate() {
    this.loadDefaults();
}

/* constant parameters */
Deflate.prototype.loadDefaults = function() {
    this.WSIZE = 32768;	// Sliding Window size
    this.STORED_BLOCK = 0;
    this.STATIC_TREES = 1;
    this.DYN_TREES = 2;
    
    /* for deflate */
    this.DEFAULT_LEVEL = 6;
    this.FULL_SEARCH = true;
    this.INBUFSIZ = 32768;	// Input buffer size
    this.INBUF_EXTRA = 64;	// Extra buffer
    this.OUTBUFSIZ = 1024 * 8;
    this.window_size = 2 * this.WSIZE;
    this.MIN_MATCH = 3;
    this.MAX_MATCH = 258;
    this.BITS = 16;
    // for SMALL_MEM
    this.LIT_BUFSIZE = 0x2000;
    this.HASH_BITS = 13;
    // for MEDIUM_MEM
    // var this.LIT_BUFSIZE = 0x4000;
    // var this.HASH_BITS = 14;
    // for BIG_MEM
    // var this.LIT_BUFSIZE = 0x8000;
    // var this.HASH_BITS = 15;
    
    /*
    if(this.LIT_BUFSIZE > this.INBUFSIZ)
        alert("error: this.INBUFSIZ is too small");
    if((this.WSIZE<<1) > (1<<this.BITS))
        alert("error: this.WSIZE is too large");
    if(this.HASH_BITS > this.BITS-1)
        alert("error: this.HASH_BITS is too large");
    if(this.HASH_BITS < 8 || this.MAX_MATCH != 258)
        alert("error: Code too clever");
    */
    
    this.DIST_BUFSIZE = this.LIT_BUFSIZE;
    this.HASH_SIZE = 1 << this.HASH_BITS;
    this.HASH_MASK = this.HASH_SIZE - 1;
    this.WMASK = this.WSIZE - 1;
    this.NIL = 0;	// Tail of hash chains
    this.TOO_FAR = 4096;
    this.MIN_LOOKAHEAD = this.MAX_MATCH + this.MIN_MATCH + 1;
    this.MAX_DIST = this.WSIZE - this.MIN_LOOKAHEAD;
    this.SMALLEST = 1;
    this.MAX_BITS = 15;
    this.MAX_BL_BITS = 7;
    this.LENGTH_CODES = 29;
    this.LITERALS = 256;
    this.END_BLOCK = 256;
    this.L_CODES = this.LITERALS + 1 + this.LENGTH_CODES;
    this.D_CODES = 30;
    this.BL_CODES = 19;
    this.REP_3_6 = 16;
    this.REPZ_3_10 = 17;
    this.REPZ_11_138 = 18;
    this.HEAP_SIZE = 2 * this.L_CODES + 1;
    this.H_SHIFT =
    parseInt((this.HASH_BITS + this.MIN_MATCH - 1) / this.MIN_MATCH);
    
    /* variables */
    this.free_queue;
    this.qhead, this.qtail;
    this.initflag;
    this.outbuf = null;
    this.outcnt, this.outoff;
    this.complete;
    this.window;
    this.d_buf;
    this.l_buf;
    this.prev;
    this.bi_buf;
    this.bi_valid;
    this.block_start;
    this.ins_h;
    this.hash_head;
    this.prev_match;
    this.match_available;
    this.match_length;
    this.prev_length;
    this.strstart;
    this.match_start;
    this.eofile;
    this.lookahead;
    this.max_chain_length;
    this.max_lazy_match;
    this.compr_level;
    this.good_match;
    this.nice_match;
    this.dyn_ltree;
    this.dyn_dtree;
    this.static_ltree;
    this.static_dtree;
    this.bl_tree;
    this.l_desc;
    this.d_desc;
    this.bl_desc;
    this.bl_count;
    this.heap;
    this.heap_len;
    this.heap_max;
    this.depth;
    this.length_code;
    this.dist_code;
    this.base_length;
    this.base_dist;
    this.flag_buf;
    this.last_lit;
    this.last_dist;
    this.last_flags;
    this.flags;
    this.flag_bit;
    this.opt_len;
    this.static_len;
    this.deflate_data;
    this.deflate_pos;
}

/* objects (deflate) */

Deflate.prototype.DeflateCT = function()
{
    this.fc = 0;		// frequency count or bit string
    this.dl = 0;		// father node in Huffman tree or length of bit string
}

Deflate.prototype.DeflateTreeDesc = function()
{
    this.dyn_tree = null;	// the dynamic tree
    this.static_tree = null;	// corresponding static tree or NULL
    this.extra_bits = null;	// extra bits for each code or NULL
    this.extra_base = 0;	// base index for extra_bits
    this.elems = 0;		// max number of elements in the tree
    this.max_length = 0;	// max bit length for the codes
    this.max_code = 0;		// largest code with non zero frequency
}

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
function DeflateConfiguration(a, b, c, d) {
    this.good_length = a;	// reduce lazy search above this match length
    this.max_lazy = b;		// do not perform lazy search above this match length
    this.nice_length = c;	// quit search above this match length
    this.max_chain = d;
}

Deflate.prototype.DeflateBuffer = function()
{
    this.next = null;
    this.len = 0;
    this.ptr = new Array(this.OUTBUFSIZ);
    this.off = 0;
}

/* constant tables */
Deflate.prototype.extra_lbits =
    new Array(0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
	      4, 4, 4, 4, 5, 5, 5, 5, 0);
Deflate.prototype.extra_dbits =
    new Array(0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
	      9, 9, 10, 10, 11, 11, 12, 12, 13, 13);
Deflate.prototype.extra_blbits =
    new Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7);
Deflate.prototype.bl_order =
    new Array(16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1,
	      15);
Deflate.prototype.configuration_table =
    new Array(
          new DeflateConfiguration(0, 0, 0, 0),
	      new DeflateConfiguration(4, 4, 8, 4),
	      new DeflateConfiguration(4, 5, 16, 8),
	      new DeflateConfiguration(4, 6, 32, 32),
	      new DeflateConfiguration(4, 4, 16, 16),
	      new DeflateConfiguration(8, 16, 32, 32),
	      new DeflateConfiguration(8, 16, 128, 128),
	      new DeflateConfiguration(8, 32, 128, 256),
	      new DeflateConfiguration(32, 128, 258, 1024),
	      new DeflateConfiguration(32, 258, 258, 4096));


/* routines (deflate) */

Deflate.prototype.deflate_start = function(level)
{
    var i;

    if (!level)
	level = this.DEFAULT_LEVEL;
    else if (level < 1)
	level = 1;
    else if (level > 9)
	level = 9;

    this.compr_level = level;
    this.initflag = false;
    this.eofile = false;
    if (this.outbuf != null)
	return;

    this.free_queue = this.qhead = this.qtail = null;
    this.outbuf = new Array(this.OUTBUFSIZ);
    this.window = new Array(this.window_size);
    this.d_buf = new Array(this.DIST_BUFSIZE);
    this.l_buf = new Array(this.INBUFSIZ + this.INBUF_EXTRA);
    this.prev = new Array(1 << this.BITS);
    this.dyn_ltree = new Array(this.HEAP_SIZE);
    for (i = 0; i < this.HEAP_SIZE; i++)
	this.dyn_ltree[i] = new this.DeflateCT();
    this.dyn_dtree = new Array(2 * this.D_CODES + 1);
    for (i = 0; i < 2 * this.D_CODES + 1; i++)
	this.dyn_dtree[i] = new this.DeflateCT();
    this.static_ltree = new Array(this.L_CODES + 2);
    for (i = 0; i < this.L_CODES + 2; i++)
	this.static_ltree[i] = new this.DeflateCT();
    this.static_dtree = new Array(this.D_CODES);
    for (i = 0; i < this.D_CODES; i++)
	this.static_dtree[i] = new this.DeflateCT();
    this.bl_tree = new Array(2 * this.BL_CODES + 1);
    for (i = 0; i < 2 * this.BL_CODES + 1; i++)
	this.bl_tree[i] = new this.DeflateCT();
    this.l_desc = new this.DeflateTreeDesc();
    this.d_desc = new this.DeflateTreeDesc();
    this.bl_desc = new this.DeflateTreeDesc();
    this.bl_count = new Array(this.MAX_BITS + 1);
    this.heap = new Array(2 * this.L_CODES + 1);
    this.depth = new Array(2 * this.L_CODES + 1);
    this.length_code = new Array(this.MAX_MATCH - this.MIN_MATCH + 1);
    this.dist_code = new Array(512);
    this.base_length = new Array(this.LENGTH_CODES);
    this.base_dist = new Array(this.D_CODES);
    this.flag_buf = new Array(parseInt(this.LIT_BUFSIZE / 8));
}

Deflate.prototype.deflate_end = function()
{
    this.free_queue = this.qhead = this.qtail = null;
    this.outbuf = null;
    this.window = null;
    this.d_buf = null;
    this.l_buf = null;
    this.prev = null;
    this.dyn_ltree = null;
    this.dyn_dtree = null;
    this.static_ltree = null;
    this.static_dtree = null;
    this.bl_tree = null;
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = null;
    this.heap = null;
    this.depth = null;
    this.length_code = null;
    this.dist_code = null;
    this.base_length = null;
    this.base_dist = null;
    this.flag_buf = null;
}

Deflate.prototype.reuse_queue = function(p)
{
    p.next = this.free_queue;
    this.free_queue = p;
}

Deflate.prototype.new_queue = function()
{
    var p;

    if (this.free_queue != null) {
	p = this.free_queue;
	this.free_queue = this.free_queue.next;
    } else
	p = new DeflateBuffer();
    p.next = null;
    p.len = p.off = 0;

    return p;
}

Deflate.prototype.head1 = function(i)
{
    return this.prev[this.WSIZE + i];
}

Deflate.prototype.head2 = function(i, val)
{
    return this.prev[this.WSIZE + i] = val;
}

/* put_byte is used for the compressed output, put_ubyte for the
 * uncompressed output. However unlzw() uses window for its
 * suffix table instead of its output buffer, so it does not use put_ubyte
 * (to be cleaned up).
 */
Deflate.prototype.put_byte = function(c)
{
    this.outbuf[this.outoff + this.outcnt++] = c;
    if (this.outoff + this.outcnt == this.OUTBUFSIZ)
	this.qoutbuf();
}

/* Output a 16 bit value, lsb first */
Deflate.prototype.put_short = function(w)
{
    w &= 0xffff;
    if (this.outoff + this.outcnt < this.OUTBUFSIZ - 2) {
	this.outbuf[this.outoff + this.outcnt++] = (w & 0xff);
	this.outbuf[this.outoff + this.outcnt++] = (w >>> 8);
    } else {
	this.put_byte(w & 0xff);
	this.put_byte(w >>> 8);
    }
}

/* ==========================================================================
 * Insert string s in the dictionary and set match_head to the previous head
 * of the hash chain (the most recent string with same hash key). Return
 * the previous length of the hash chain.
 * IN  assertion: all calls to to INSERT_STRING are made with consecutive
 *    input characters and the first MIN_MATCH bytes of s are valid
 *    (except for the last MIN_MATCH-1 bytes of the input file).
 */
Deflate.prototype.INSERT_STRING = function()
{
    this.ins_h = ((this.ins_h << this.H_SHIFT)
		  ^ (this.
		     window[this.strstart + this.MIN_MATCH - 1] & 0xff))
	& this.HASH_MASK;
    this.hash_head = this.head1(this.ins_h);
    this.prev[this.strstart & this.WMASK] = this.hash_head;
    this.head2(this.ins_h, this.strstart);
}

/* Send a code of the given tree. c and tree must not have side effects */
Deflate.prototype.SEND_CODE = function(c, tree)
{
    this.send_bits(tree[c].fc, tree[c].dl);
}

/* Mapping from a distance to a distance code. dist is the distance - 1 and
 * must not have side effects. dist_code[256] and dist_code[257] are never
 * used.
 */
Deflate.prototype.D_CODE = function(dist)
{
    return (dist < 256 ? this.dist_code[dist]
	    : this.dist_code[256 + (dist >> 7)]) & 0xff;
}

/* ==========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
Deflate.prototype.SMALLER = function(tree, n, m)
{
    return tree[n].fc < tree[m].fc ||
	(tree[n].fc == tree[m].fc && this.depth[n] <= this.depth[m]);
}

/* ==========================================================================
 * read string data
 */
Deflate.prototype.read_buff = function(buff, offset, n)
{
    var i;
    for (i = 0; i < n && this.deflate_pos < this.deflate_data.length; i++)
        buff[offset + i] = this.deflate_data[this.deflate_pos++] & 0xff;
    return i;
}

/* ==========================================================================
 * Initialize the "longest match" routines for a new file
 */
Deflate.prototype.lm_init = function()
{
    var j;

    /* Initialize the hash table. */
    for (j = 0; j < this.HASH_SIZE; j++)
	this.prev[this.WSIZE + j] = 0;
    /* prev will be initialized on the fly */

    /* Set the default configuration parameters:
     */
    this.max_lazy_match =
	this.configuration_table[this.compr_level].max_lazy;
    this.good_match =
	this.configuration_table[this.compr_level].good_length;
    if (!this.FULL_SEARCH)
	this.nice_match =
	    this.configuration_table[this.compr_level].nice_length;
    this.max_chain_length =
	this.configuration_table[this.compr_level].max_chain;

    this.strstart = 0;
    this.block_start = 0;

    this.lookahead = this.read_buff(this.window, 0, 2 * this.WSIZE);
    if (this.lookahead <= 0) {
	this.eofile = true;
	this.lookahead = 0;
	return;
    }
    this.eofile = false;
    /* Make sure that we always have enough lookahead. This is important
     * if input comes from a device such as a tty.
     */
    while (this.lookahead < this.MIN_LOOKAHEAD && !this.eofile)
	this.fill_window();

    /* If lookahead < MIN_MATCH, ins_h is garbage, but this is
     * not important since only literal bytes will be emitted.
     */
    this.ins_h = 0;
    for (j = 0; j < this.MIN_MATCH - 1; j++) {
	//      UPDATE_HASH(ins_h, window[j]);
	this.ins_h =
	    ((this.ins_h << this.H_SHIFT) ^ (this.
					     window[j] & 0xff)) & this.
	    HASH_MASK;
    }
}

/* ==========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 */
Deflate.prototype.longest_match = function(cur_match)
{
    var chain_length = this.max_chain_length;	// max hash chain length
    var scanp = this.strstart;	// current string
    var matchp;			// matched string
    var len;			// length of current match
    var best_len = this.prev_length;	// best match length so far

    /* Stop when cur_match becomes <= limit. To simplify the code,
     * we prevent matches with the string of window index 0.
     */
    var limit =
	(this.strstart >
	 this.MAX_DIST ? this.strstart - this.MAX_DIST : this.NIL);

    var strendp = this.strstart + this.MAX_MATCH;
    var scan_end1 = this.window[scanp + best_len - 1];
    var scan_end = this.window[scanp + best_len];

    /* Do not waste too much time if we already have a good match: */
    if (this.prev_length >= this.good_match)
	chain_length >>= 2;

    //  Assert(encoder->strstart <= window_size-MIN_LOOKAHEAD, "insufficient lookahead");

    do {
	//    Assert(cur_match < encoder->strstart, "no future");
	matchp = cur_match;

	/* Skip to next match if the match length cannot increase
	 * or if the match length is less than 2:
	 */
	if (this.window[matchp + best_len] != scan_end ||
	    this.window[matchp + best_len - 1] != scan_end1 ||
	    this.window[matchp] != this.window[scanp] ||
	    this.window[++matchp] != this.window[scanp + 1]) {
	    continue;
	}

	/* The check at best_len-1 can be removed because it will be made
	 * again later. (This heuristic is not always a win.)
	 * It is not necessary to compare scan[2] and match[2] since they
	 * are always equal when the other bytes match, given that
	 * the hash keys are equal and that HASH_BITS >= 8.
	 */
	scanp += 2;
	matchp++;

	/* We check for insufficient lookahead only every 8th comparison;
	 * the 256th check will be made at strstart+258.
	 */
	do {
	} while (this.window[++scanp] == this.window[++matchp] &&
		 this.window[++scanp] == this.window[++matchp] &&
		 this.window[++scanp] == this.window[++matchp] &&
		 this.window[++scanp] == this.window[++matchp] &&
		 this.window[++scanp] == this.window[++matchp] &&
		 this.window[++scanp] == this.window[++matchp] &&
		 this.window[++scanp] == this.window[++matchp] &&
		 this.window[++scanp] == this.window[++matchp] &&
		 scanp < strendp);

	len = this.MAX_MATCH - (strendp - scanp);
	scanp = strendp - this.MAX_MATCH;

	if (len > best_len) {
	    this.match_start = cur_match;
	    best_len = len;
	    if (this.FULL_SEARCH) {
		if (len >= this.MAX_MATCH)
		    break;
	    } else {
		if (len >= this.nice_match)
		    break;
	    }

	    scan_end1 = this.window[scanp + best_len - 1];
	    scan_end = this.window[scanp + best_len];
	}
    } while ((cur_match = this.prev[cur_match & this.WMASK]) > limit
	     && --chain_length != 0);

    return best_len;
}

/* ==========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead, and sets eofile if end of input file.
 * IN assertion: lookahead < MIN_LOOKAHEAD && strstart + lookahead > 0
 * OUT assertions: at least one byte has been read, or eofile is set;
 *    file reads are performed for at least two bytes (required for the
 *    translate_eol option).
 */
Deflate.prototype.fill_window = function()
{
    var n, m;

    // Amount of free space at the end of the window.
    var more = this.window_size - this.lookahead - this.strstart;

    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (more == -1) {
	/* Very unlikely, but possible on 16 bit machine if strstart == 0
	 * and lookahead == 1 (input done one byte at time)
	 */
	more--;
    } else if (this.strstart >= this.WSIZE + this.MAX_DIST) {
	/* By the IN assertion, the window is not empty so we can't confuse
	 * more == 0 with more == 64K on a 16 bit machine.
	 */
	//     Assert(window_size == (ulg)2*WSIZE, "no sliding with BIG_MEM");

	// System.arraycopy(window, WSIZE, window, 0, WSIZE);
	for (n = 0; n < this.WSIZE; n++)
	    this.window[n] = this.window[n + this.WSIZE];

	this.match_start -= this.WSIZE;
	this.strstart -= this.WSIZE;	/* we now have strstart >= MAX_DIST: */
	this.block_start -= this.WSIZE;

	for (n = 0; n < this.HASH_SIZE; n++) {
	    m = this.head1(n);
	    this.head2(n, m >= this.WSIZE ? m - this.WSIZE : this.NIL);
	}
	for (n = 0; n < this.WSIZE; n++) {
	    /* If n is not on any hash chain, prev[n] is garbage but
	     * its value will never be used.
	     */
	    m = this.prev[n];
	    this.prev[n] = (m >= this.WSIZE ? m - this.WSIZE : this.NIL);
	}
	more += this.WSIZE;
    }
    // At this point, more >= 2
    if (!this.eofile) {
	n = this.read_buff(this.window, this.strstart + this.lookahead,
			   more);
	if (n <= 0)
	    this.eofile = true;
	else
	    this.lookahead += n;
    }
}

/* ==========================================================================
 * Processes a new input file and return its compressed length. This
 * function does not perform lazy evaluationof matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
Deflate.prototype.deflate_fast = function()
{
    while (this.lookahead != 0 && this.qhead == null) {
	var flush;		// set if current block must be flushed

	/* Insert the string window[strstart .. strstart+2] in the
	 * dictionary, and set hash_head to the head of the hash chain:
	 */
	this.INSERT_STRING();

	/* Find the longest match, discarding those <= prev_length.
	 * At this point we have always match_length < MIN_MATCH
	 */
	if (this.hash_head != this.NIL &&
	    this.strstart - this.hash_head <= this.MAX_DIST) {
	    /* To simplify the code, we prevent matches with the string
	     * of window index 0 (in particular we have to avoid a match
	     * of the string with itself at the start of the input file).
	     */
	    this.match_length = this.longest_match(this.hash_head);
	    /* longest_match() sets match_start */
	    if (this.match_length > this.lookahead)
		this.match_length = this.lookahead;
	}
	if (this.match_length >= this.MIN_MATCH) {
	    //          check_match(strstart, match_start, match_length);

	    flush = this.ct_tally(this.strstart - this.match_start,
				  this.match_length - this.MIN_MATCH);
	    this.lookahead -= this.match_length;

	    /* Insert new strings in the hash table only if the match length
	     * is not too large. This saves time but degrades compression.
	     */
	    if (this.match_length <= this.max_lazy_match) {
		this.match_length--;	// string at strstart already in hash table
		do {
		    this.strstart++;
		    this.INSERT_STRING();
		    /* strstart never exceeds WSIZE-MAX_MATCH, so there are
		     * always MIN_MATCH bytes ahead. If lookahead < MIN_MATCH
		     * these bytes are garbage, but it does not matter since
		     * the next lookahead bytes will be emitted as literals.
		     */
		} while (--this.match_length != 0);
		this.strstart++;
	    } else {
		this.strstart += this.match_length;
		this.match_length = 0;
		this.ins_h = this.window[this.strstart] & 0xff;
		//              UPDATE_HASH(ins_h, window[strstart + 1]);
		this.ins_h =
		    ((this.ins_h << this.H_SHIFT) ^ (this.
						     window[this.strstart +
							    1] & 0xff)) &
		    this.HASH_MASK;

		//#if MIN_MATCH != 3
		//          Call UPDATE_HASH() MIN_MATCH-3 more times
		//#endif

	    }
	} else {
	    /* No match, output a literal byte */
	    flush = this.ct_tally(0, this.window[this.strstart] & 0xff);
	    this.lookahead--;
	    this.strstart++;
	}
	if (flush) {
	    this.flush_block(0);
	    this.block_start = this.strstart;
	}

	/* Make sure that we always have enough lookahead, except
	 * at the end of the input file. We need MAX_MATCH bytes
	 * for the next match, plus MIN_MATCH bytes to insert the
	 * string following the next match.
	 */
	while (this.lookahead < this.MIN_LOOKAHEAD && !this.eofile)
	    this.fill_window();
    }
}

Deflate.prototype.deflate_better = function()
{
    /* Process the input block. */
    while (this.lookahead != 0 && this.qhead == null) {
	/* Insert the string window[strstart .. strstart+2] in the
	 * dictionary, and set hash_head to the head of the hash chain:
	 */
	this.INSERT_STRING();

	/* Find the longest match, discarding those <= prev_length.
	 */
	this.prev_length = this.match_length;
	this.prev_match = this.match_start;
	this.match_length = this.MIN_MATCH - 1;

	if (this.hash_head != this.NIL &&
	    this.prev_length < this.max_lazy_match &&
	    this.strstart - this.hash_head <= this.MAX_DIST) {
	    /* To simplify the code, we prevent matches with the string
	     * of window index 0 (in particular we have to avoid a match
	     * of the string with itself at the start of the input file).
	     */
	    this.match_length = this.longest_match(this.hash_head);
	    /* longest_match() sets match_start */
	    if (this.match_length > this.lookahead)
		this.match_length = this.lookahead;

	    /* Ignore a length 3 match if it is too distant: */
	    if (this.match_length == this.MIN_MATCH &&
		this.strstart - this.match_start > this.TOO_FAR) {
		/* If prev_match is also MIN_MATCH, match_start is garbage
		 * but we will ignore the current match anyway.
		 */
		this.match_length--;
	    }
	}
	/* If there was a match at the previous step and the current
	 * match is not better, output the previous match:
	 */
	if (this.prev_length >= this.MIN_MATCH &&
	    this.match_length <= this.prev_length) {
	    var flush;		// set if current block must be flushed

	    //          check_match(strstart - 1, prev_match, prev_length);
	    flush = this.ct_tally(this.strstart - 1 - this.prev_match,
				  this.prev_length - this.MIN_MATCH);

	    /* Insert in hash table all strings up to the end of the match.
	     * strstart-1 and strstart are already inserted.
	     */
	    this.lookahead -= this.prev_length - 1;
	    this.prev_length -= 2;
	    do {
		this.strstart++;
		this.INSERT_STRING();
		/* strstart never exceeds WSIZE-MAX_MATCH, so there are
		 * always MIN_MATCH bytes ahead. If lookahead < MIN_MATCH
		 * these bytes are garbage, but it does not matter since the
		 * next lookahead bytes will always be emitted as literals.
		 */
	    } while (--this.prev_length != 0);
	    this.match_available = 0;
	    this.match_length = this.MIN_MATCH - 1;
	    this.strstart++;
	    if (flush) {
		this.flush_block(0);
		this.block_start = this.strstart;
	    }
	} else if (this.match_available != 0) {
	    /* If there was no match at the previous position, output a
	     * single literal. If there was a match but the current match
	     * is longer, truncate the previous match to a single literal.
	     */
	    if (this.ct_tally(0, this.window[this.strstart - 1] & 0xff)) {
		this.flush_block(0);
		this.block_start = this.strstart;
	    }
	    this.strstart++;
	    this.lookahead--;
	} else {
	    /* There is no previous match to compare with, wait for
	     * the next step to decide.
	     */
	    this.match_available = 1;
	    this.strstart++;
	    this.lookahead--;
	}

	/* Make sure that we always have enough lookahead, except
	 * at the end of the input file. We need MAX_MATCH bytes
	 * for the next match, plus MIN_MATCH bytes to insert the
	 * string following the next match.
	 */
	while (this.lookahead < this.MIN_LOOKAHEAD && !this.eofile)
	    this.fill_window();
    }
}

Deflate.prototype.init_deflate = function()
{
    if (this.eofile)
	return;
    this.bi_buf = 0;
    this.bi_valid = 0;
    this.ct_init();
    this.lm_init();

    this.qhead = null;
    this.outcnt = 0;
    this.outoff = 0;

    if (this.compr_level <= 3) {
	this.prev_length = this.MIN_MATCH - 1;
	this.match_length = 0;
    } else {
	this.match_length = this.MIN_MATCH - 1;
	this.match_available = 0;
    }

    this.complete = false;
}

/* ==========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
Deflate.prototype.deflate_internal = function(buff, off, buff_size)
{
    var n;

    if (!this.initflag) {
        this.init_deflate();
        this.initflag = true;
        if (this.lookahead == 0) {	// empty
            this.complete = true;
            return 0;
        }
    }

    if ((n = this.qcopy(buff, off, buff_size)) == buff_size)
        return buff_size;

    if (this.complete) return n;

    if (this.compr_level <= 3)	// optimized for speed
        this.deflate_fast();
    else
        this.deflate_better();
    if (this.lookahead == 0) {
        if (this.match_available != 0)
            this.ct_tally(0, this.window[this.strstart - 1] & 0xff);
        this.flush_block(1);
        this.complete = true;
    }
    return n + this.qcopy(buff, n + off, buff_size - n);
}

Deflate.prototype.qcopy = function(buff, off, buff_size)
{
    var n, i, j;

    n = 0;
    while (this.qhead != null && n < buff_size) {
	i = buff_size - n;
	if (i > this.qhead.len)
	    i = this.qhead.len;
	//      System.arraycopy(qhead.ptr, qhead.off, buff, off + n, i);
	for (j = 0; j < i; j++)
	    buff[off + n + j] = this.qhead.ptr[this.qhead.off + j];

	this.qhead.off += i;
	this.qhead.len -= i;
	n += i;
	if (this.qhead.len == 0) {
	    var p;
	    p = this.qhead;
	    this.qhead = this.qhead.next;
	    this.reuse_queue(p);
	}
    }

    if (n == buff_size)
	return n;

    if (this.outoff < this.outcnt) {
	i = buff_size - n;
	if (i > this.outcnt - this.outoff)
	    i = this.outcnt - this.outoff;
	// System.arraycopy(outbuf, outoff, buff, off + n, i);
	for (j = 0; j < i; j++)
	    buff[off + n + j] = this.outbuf[this.outoff + j];
	this.outoff += i;
	n += i;
	if (this.outcnt == this.outoff)
	    this.outcnt = this.outoff = 0;
    }
    return n;
}

/* ==========================================================================
 * Allocate the match buffer, initialize the various tables and save the
 * location of the internal file attribute (ascii/binary) and method
 * (DEFLATE/STORE).
 */
Deflate.prototype.ct_init = function()
{
    var n;			// iterates over tree elements
    var bits;			// bit counter
    var length;			// length value
    var code;			// code value
    var dist;			// distance index

    if (this.static_dtree[0].dl != 0)
	return;			// ct_init already called

    this.l_desc.dyn_tree = this.dyn_ltree;
    this.l_desc.static_tree = this.static_ltree;
    this.l_desc.extra_bits = this.extra_lbits;
    this.l_desc.extra_base = this.LITERALS + 1;
    this.l_desc.elems = this.L_CODES;
    this.l_desc.max_length = this.MAX_BITS;
    this.l_desc.max_code = 0;

    this.d_desc.dyn_tree = this.dyn_dtree;
    this.d_desc.static_tree = this.static_dtree;
    this.d_desc.extra_bits = this.extra_dbits;
    this.d_desc.extra_base = 0;
    this.d_desc.elems = this.D_CODES;
    this.d_desc.max_length = this.MAX_BITS;
    this.d_desc.max_code = 0;

    this.bl_desc.dyn_tree = this.bl_tree;
    this.bl_desc.static_tree = null;
    this.bl_desc.extra_bits = this.extra_blbits;
    this.bl_desc.extra_base = 0;
    this.bl_desc.elems = this.BL_CODES;
    this.bl_desc.max_length = this.MAX_BL_BITS;
    this.bl_desc.max_code = 0;

    // Initialize the mapping length (0..255) -> length code (0..28)
    length = 0;
    for (code = 0; code < this.LENGTH_CODES - 1; code++) {
	this.base_length[code] = length;
	for (n = 0; n < (1 << this.extra_lbits[code]); n++)
	    this.length_code[length++] = code;
    }
    // Assert (length == 256, "ct_init: length != 256");

    /* Note that the length 255 (match length 258) can be represented
     * in two different ways: code 284 + 5 bits or code 285, so we
     * overwrite length_code[255] to use the best encoding:
     */
    this.length_code[length - 1] = code;

    /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
    dist = 0;
    for (code = 0; code < 16; code++) {
	this.base_dist[code] = dist;
	for (n = 0; n < (1 << this.extra_dbits[code]); n++) {
	    this.dist_code[dist++] = code;
	}
    }
    // Assert (dist == 256, "ct_init: dist != 256");
    dist >>= 7;			// from now on, all distances are divided by 128
    for (; code < this.D_CODES; code++) {
	this.base_dist[code] = dist << 7;
	for (n = 0; n < (1 << (this.extra_dbits[code] - 7)); n++)
	    this.dist_code[256 + dist++] = code;
    }
    // Assert (dist == 256, "ct_init: 256+dist != 512");

    // Construct the codes of the static literal tree
    for (bits = 0; bits <= this.MAX_BITS; bits++)
	this.bl_count[bits] = 0;
    n = 0;
    while (n <= 143) {
	this.static_ltree[n++].dl = 8;
	this.bl_count[8]++;
    }
    while (n <= 255) {
	this.static_ltree[n++].dl = 9;
	this.bl_count[9]++;
    }
    while (n <= 279) {
	this.static_ltree[n++].dl = 7;
	this.bl_count[7]++;
    }
    while (n <= 287) {
	this.static_ltree[n++].dl = 8;
	this.bl_count[8]++;
    }
    /* Codes 286 and 287 do not exist, but we must include them in the
     * tree construction to get a canonical Huffman tree (longest code
     * all ones)
     */
    this.gen_codes(this.static_ltree, this.L_CODES + 1);

    /* The static distance tree is trivial: */
    for (n = 0; n < this.D_CODES; n++) {
	this.static_dtree[n].dl = 5;
	this.static_dtree[n].fc = this.bi_reverse(n, 5);
    }

    // Initialize the first block of the first file:
    this.init_block();
}

/* ==========================================================================
 * Initialize a new block.
 */
Deflate.prototype.init_block = function()
{
    var n;			// iterates over tree elements

    // Initialize the trees.
    for (n = 0; n < this.L_CODES; n++)
	this.dyn_ltree[n].fc = 0;
    for (n = 0; n < this.D_CODES; n++)
	this.dyn_dtree[n].fc = 0;
    for (n = 0; n < this.BL_CODES; n++)
	this.bl_tree[n].fc = 0;

    this.dyn_ltree[this.END_BLOCK].fc = 1;
    this.opt_len = this.static_len = 0;
    this.last_lit = this.last_dist = this.last_flags = 0;
    this.flags = 0;
    this.flag_bit = 1;
}

/* ==========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
Deflate.prototype.pqdownheap = function(tree, k)
{				// node to move down
    var v = this.heap[k];
    var j = k << 1;		// left son of k

    while (j <= this.heap_len) {
	// Set j to the smallest of the two sons:
	if (j < this.heap_len &&
	    this.SMALLER(tree, this.heap[j + 1], this.heap[j]))
	    j++;

	// Exit if v is smaller than both sons
	if (this.SMALLER(tree, v, this.heap[j]))
	    break;

	// Exchange v with the smallest son
	this.heap[k] = this.heap[j];
	k = j;

	// And continue down the tree, setting j to the left son of k
	j <<= 1;
    }
    this.heap[k] = v;
}

/* ==========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
Deflate.prototype.gen_bitlen = function(desc)
{				// the tree descriptor
    var tree = desc.dyn_tree;
    var extra = desc.extra_bits;
    var base = desc.extra_base;
    var max_code = desc.max_code;
    var max_length = desc.max_length;
    var stree = desc.static_tree;
    var h;			// heap index
    var n, m;			// iterate over the tree elements
    var bits;			// bit length
    var xbits;			// extra bits
    var f;			// frequency
    var overflow = 0;		// number of elements with bit length too large

    for (bits = 0; bits <= this.MAX_BITS; bits++)
	this.bl_count[bits] = 0;

    /* In a first pass, compute the optimal bit lengths (which may
     * overflow in the case of the bit length tree).
     */
    tree[this.heap[this.heap_max]].dl = 0;	// root of the heap

    for (h = this.heap_max + 1; h < this.HEAP_SIZE; h++) {
	n = this.heap[h];
	bits = tree[tree[n].dl].dl + 1;
	if (bits > max_length) {
	    bits = max_length;
	    overflow++;
	}
	tree[n].dl = bits;
	// We overwrite tree[n].dl which is no longer needed

	if (n > max_code)
	    continue;		// not a leaf node

	this.bl_count[bits]++;
	xbits = 0;
	if (n >= base)
	    xbits = extra[n - base];
	f = tree[n].fc;
	this.opt_len += f * (bits + xbits);
	if (stree != null)
	    this.static_len += f * (stree[n].dl + xbits);
    }
    if (overflow == 0)
	return;

    // This happens for example on obj2 and pic of the Calgary corpus

    // Find the first bit length which could increase:
    do {
	bits = max_length - 1;
	while (this.bl_count[bits] == 0)
	    bits--;
	this.bl_count[bits]--;	// move one leaf down the tree
	this.bl_count[bits + 1] += 2;	// move one overflow item as its brother
	this.bl_count[max_length]--;
	/* The brother of the overflow item also moves one step up,
	 * but this does not affect bl_count[max_length]
	 */
	overflow -= 2;
    } while (overflow > 0);

    /* Now recompute all bit lengths, scanning in increasing frequency.
     * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
     * lengths instead of fixing only the wrong ones. This idea is taken
     * from 'ar' written by Haruhiko Okumura.)
     */
    for (bits = max_length; bits != 0; bits--) {
	n = this.bl_count[bits];
	while (n != 0) {
	    m = this.heap[--h];
	    if (m > max_code)
		continue;
	    if (tree[m].dl != bits) {
		this.opt_len += (bits - tree[m].dl) * tree[m].fc;
		tree[m].fc = bits;
	    }
	    n--;
	}
    }
}

/* ==========================================================================
   * Generate the codes for a given tree and bit counts (which need not be
   * optimal).
   * IN assertion: the array bl_count contains the bit length statistics for
   * the given tree and the field len is set for all tree elements.
   * OUT assertion: the field code is set for all tree elements of non
   *     zero code length.
   */
Deflate.prototype.gen_codes = function(tree, max_code)
{				// largest code with non zero frequency
    var next_code = new Array(this.MAX_BITS + 1);	// next code value for each bit length
    var code = 0;		// running code value
    var bits;			// bit index
    var n;			// code index

    /* The distribution counts are first used to generate the code values
     * without bit reversal.
     */
    for (bits = 1; bits <= this.MAX_BITS; bits++) {
	code = ((code + this.bl_count[bits - 1]) << 1);
	next_code[bits] = code;
    }

    /* Check that the bit counts in bl_count are consistent. The last code
     * must be all ones.
     */
    //    Assert (code + encoder->bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
    //     "inconsistent bit counts");
    //    Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

    for (n = 0; n <= max_code; n++) {
	var len = tree[n].dl;
	if (len == 0)
	    continue;
	// Now reverse the bits
	tree[n].fc = this.bi_reverse(next_code[len]++, len);

	//      Tracec(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
	//    n, (isgraph(n) ? n : ' '), len, tree[n].fc, next_code[len]-1));
    }
}

/* ==========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
Deflate.prototype.build_tree = function(desc)
{				// the tree descriptor
    var tree = desc.dyn_tree;
    var stree = desc.static_tree;
    var elems = desc.elems;
    var n, m;			// iterate over heap elements
    var max_code = -1;		// largest code with non zero frequency
    var node = elems;		// next internal node of the tree

    /* Construct the initial heap, with least frequent element in
     * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
     * heap[0] is not used.
     */
    this.heap_len = 0;
    this.heap_max = this.HEAP_SIZE;

    for (n = 0; n < elems; n++) {
	if (tree[n].fc != 0) {
	    this.heap[++this.heap_len] = max_code = n;
	    this.depth[n] = 0;
	} else
	    tree[n].dl = 0;
    }

    /* The pkzip format requires that at least one distance code exists,
     * and that at least one bit should be sent even if there is only one
     * possible code. So to avoid special checks later on we force at least
     * two codes of non zero frequency.
     */
    while (this.heap_len < 2) {
	var xnew = this.heap[++this.heap_len] =
	    (max_code < 2 ? ++max_code : 0);
	tree[xnew].fc = 1;
	this.depth[xnew] = 0;
	this.opt_len--;
	if (stree != null)
	    this.static_len -= stree[xnew].dl;
	// new is 0 or 1 so it does not have extra bits
    }
    desc.max_code = max_code;

    /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
     * establish sub-heaps of increasing lengths:
     */
    for (n = this.heap_len >> 1; n >= 1; n--)
	this.pqdownheap(tree, n);

    /* Construct the Huffman tree by repeatedly combining the least two
     * frequent nodes.
     */
    do {
	n = this.heap[this.SMALLEST];
	this.heap[this.SMALLEST] = this.heap[this.heap_len--];
	this.pqdownheap(tree, this.SMALLEST);

	m = this.heap[this.SMALLEST];	// m = node of next least frequency

	// keep the nodes sorted by frequency
	this.heap[--this.heap_max] = n;
	this.heap[--this.heap_max] = m;

	// Create a new node father of n and m
	tree[node].fc = tree[n].fc + tree[m].fc;
	//  depth[node] = (char)(MAX(depth[n], depth[m]) + 1);
	if (this.depth[n] > this.depth[m] + 1)
	    this.depth[node] = this.depth[n];
	else
	    this.depth[node] = this.depth[m] + 1;
	tree[n].dl = tree[m].dl = node;

	// and insert the new node in the heap
	this.heap[this.SMALLEST] = node++;
	this.pqdownheap(tree, this.SMALLEST);

    } while (this.heap_len >= 2);

    this.heap[--this.heap_max] = this.heap[this.SMALLEST];

    /* At this point, the fields freq and dad are set. We can now
     * generate the bit lengths.
     */
    this.gen_bitlen(desc);

    // The field len is now set, we can generate the bit codes
    this.gen_codes(tree, max_code);
}

/* ==========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree. Updates opt_len to take into account the repeat
 * counts. (The contribution of the bit length codes will be added later
 * during the construction of bl_tree.)
 */
Deflate.prototype.scan_tree = function(tree, max_code)
{				// and its largest code of non zero frequency
    var n;			// iterates over all tree elements
    var prevlen = -1;		// last emitted length
    var curlen;			// length of current code
    var nextlen = tree[0].dl;	// length of next code
    var count = 0;		// repeat count of the current code
    var max_count = 7;		// max repeat count
    var min_count = 4;		// min repeat count

    if (nextlen == 0) {
	max_count = 138;
	min_count = 3;
    }
    tree[max_code + 1].dl = 0xffff;	// guard

    for (n = 0; n <= max_code; n++) {
	curlen = nextlen;
	nextlen = tree[n + 1].dl;
	if (++count < max_count && curlen == nextlen)
	    continue;
	else if (count < min_count)
	    this.bl_tree[curlen].fc += count;
	else if (curlen != 0) {
	    if (curlen != prevlen)
		this.bl_tree[curlen].fc++;
	    this.bl_tree[this.REP_3_6].fc++;
	} else if (count <= 10)
	    this.bl_tree[this.REPZ_3_10].fc++;
	else
	    this.bl_tree[this.REPZ_11_138].fc++;
	count = 0;
	prevlen = curlen;
	if (nextlen == 0) {
	    max_count = 138;
	    min_count = 3;
	} else if (curlen == nextlen) {
	    max_count = 6;
	    min_count = 3;
	} else {
	    max_count = 7;
	    min_count = 4;
	}
    }
}

  /* ==========================================================================
   * Send a literal or distance tree in compressed form, using the codes in
   * bl_tree.
   */
Deflate.prototype.send_tree = function(tree, max_code)
{				// and its largest code of non zero frequency
    var n;			// iterates over all tree elements
    var prevlen = -1;		// last emitted length
    var curlen;			// length of current code
    var nextlen = tree[0].dl;	// length of next code
    var count = 0;		// repeat count of the current code
    var max_count = 7;		// max repeat count
    var min_count = 4;		// min repeat count

    /* tree[max_code+1].dl = -1; *//* guard already set */
    if (nextlen == 0) {
	max_count = 138;
	min_count = 3;
    }

    for (n = 0; n <= max_code; n++) {
	curlen = nextlen;
	nextlen = tree[n + 1].dl;
	if (++count < max_count && curlen == nextlen) {
	    continue;
	} else if (count < min_count) {
	    do {
		this.SEND_CODE(curlen, this.bl_tree);
	    } while (--count != 0);
	} else if (curlen != 0) {
	    if (curlen != prevlen) {
		this.SEND_CODE(curlen, this.bl_tree);
		count--;
	    }
	    // Assert(count >= 3 && count <= 6, " 3_6?");
	    this.SEND_CODE(this.REP_3_6, this.bl_tree);
	    this.send_bits(count - 3, 2);
	} else if (count <= 10) {
	    this.SEND_CODE(this.REPZ_3_10, this.bl_tree);
	    this.send_bits(count - 3, 3);
	} else {
	    this.SEND_CODE(this.REPZ_11_138, this.bl_tree);
	    this.send_bits(count - 11, 7);
	}
	count = 0;
	prevlen = curlen;
	if (nextlen == 0) {
	    max_count = 138;
	    min_count = 3;
	} else if (curlen == nextlen) {
	    max_count = 6;
	    min_count = 3;
	} else {
	    max_count = 7;
	    min_count = 4;
	}
    }
}

/* ==========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
Deflate.prototype.build_bl_tree = function()
{
    var max_blindex;		// index of last bit length code of non zero freq

    // Determine the bit length frequencies for literal and distance trees
    this.scan_tree(this.dyn_ltree, this.l_desc.max_code);
    this.scan_tree(this.dyn_dtree, this.d_desc.max_code);

    // Build the bit length tree:
    this.build_tree(this.bl_desc);
    /* opt_len now includes the length of the tree representations, except
     * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
     */

    /* Determine the number of bit length codes to send. The pkzip format
     * requires that at least 4 bit length codes be sent. (appnote.txt says
     * 3 but the actual value used is 4.)
     */
    for (max_blindex = this.BL_CODES - 1; max_blindex >= 3; max_blindex--) {
	if (this.bl_tree[this.bl_order[max_blindex]].dl != 0)
	    break;
    }
    /* Update opt_len to include the bit length tree and counts */
    this.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    //    Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
    //      encoder->opt_len, encoder->static_len));

    return max_blindex;
}

/* ==========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
Deflate.prototype.send_all_trees = function(lcodes, dcodes, blcodes)
{				// number of codes for each tree
    var rank;			// index in bl_order

    //    Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
    //    Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
    //      "too many codes");
    //    Tracev((stderr, "\nbl counts: "));
    this.send_bits(lcodes - 257, 5);	// not +255 as stated in appnote.txt
    this.send_bits(dcodes - 1, 5);
    this.send_bits(blcodes - 4, 4);	// not -3 as stated in appnote.txt
    for (rank = 0; rank < blcodes; rank++) {
	//      Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
	this.send_bits(this.bl_tree[this.bl_order[rank]].dl, 3);
    }

    // send the literal tree
    this.send_tree(this.dyn_ltree, lcodes - 1);

    // send the distance tree
    this.send_tree(this.dyn_dtree, dcodes - 1);
}

/* ==========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
Deflate.prototype.flush_block = function(eof)
{				// true if this is the last block for a file
    var opt_lenb, static_lenb;	// opt_len and static_len in bytes
    var max_blindex;		// index of last bit length code of non zero freq
    var stored_len;		// length of input block

    stored_len = this.strstart - this.block_start;
    this.flag_buf[this.last_flags] = this.flags;	// Save the flags for the last 8 items

    // Construct the literal and distance trees
    this.build_tree(this.l_desc);
    //    Tracev((stderr, "\nlit data: dyn %ld, stat %ld",
    //      encoder->opt_len, encoder->static_len));

    this.build_tree(this.d_desc);
    //    Tracev((stderr, "\ndist data: dyn %ld, stat %ld",
    //      encoder->opt_len, encoder->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = this.build_bl_tree();

    // Determine the best encoding. Compute first the block length in bytes
    opt_lenb = (this.opt_len + 3 + 7) >> 3;
    static_lenb = (this.static_len + 3 + 7) >> 3;

    //    Trace((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u dist %u ",
    //     opt_lenb, encoder->opt_len,
    //     static_lenb, encoder->static_len, stored_len,
    //     encoder->last_lit, encoder->last_dist));

    if (static_lenb <= opt_lenb)
	opt_lenb = static_lenb;
    if (stored_len + 4 <= opt_lenb	// 4: two words for the lengths
	&& this.block_start >= 0) {
	var i;

	/* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
	 * Otherwise we can't have processed more than WSIZE input bytes since
	 * the last block flush, because compression would have been
	 * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
	 * transform a block into a stored block.
	 */
	this.send_bits((this.STORED_BLOCK << 1) + eof, 3);	/* send block type */
	this.bi_windup();	/* align on byte boundary */
	this.put_short(stored_len);
	this.put_short(~stored_len);

	// copy block
	/*
	   p = &window[block_start];
	   for(i = 0; i < stored_len; i++)
	   put_byte(p[i]);
	 */
	for (i = 0; i < stored_len; i++)
	    this.put_byte(this.window[this.block_start + i]);

    } else if (static_lenb == opt_lenb) {
	this.send_bits((this.STATIC_TREES << 1) + eof, 3);
	this.compress_block(this.static_ltree, this.static_dtree);
    } else {
	this.send_bits((this.DYN_TREES << 1) + eof, 3);
	this.send_all_trees(this.l_desc.max_code + 1,
			    this.d_desc.max_code + 1, max_blindex + 1);
	this.compress_block(this.dyn_ltree, this.dyn_dtree);
    }

    this.init_block();

    if (eof != 0)
	this.bi_windup();
}

/* ==========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
Deflate.prototype.ct_tally = function(dist, lc)
{				// match length-MIN_MATCH or unmatched char (if dist==0)
    this.l_buf[this.last_lit++] = lc;
    if (dist == 0) {
	// lc is the unmatched char
	this.dyn_ltree[lc].fc++;
    } else {
	// Here, lc is the match length - MIN_MATCH
	dist--;			// dist = match distance - 1
	//      Assert((ush)dist < (ush)MAX_DIST &&
	//       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
	//       (ush)D_CODE(dist) < (ush)D_CODES,  "ct_tally: bad match");

	this.dyn_ltree[this.length_code[lc] + this.LITERALS + 1].fc++;
	this.dyn_dtree[this.D_CODE(dist)].fc++;

	this.d_buf[this.last_dist++] = dist;
	this.flags |= this.flag_bit;
    }
    this.flag_bit <<= 1;

    // Output the flags if they fill a byte
    if ((this.last_lit & 7) == 0) {
	this.flag_buf[this.last_flags++] = this.flags;
	this.flags = 0;
	this.flag_bit = 1;
    }
    // Try to guess if it is profitable to stop the current block here
    if (this.compr_level > 2 && (this.last_lit & 0xfff) == 0) {
	// Compute an upper bound for the compressed length
	var out_length = this.last_lit * 8;
	var in_length = this.strstart - this.block_start;
	var dcode;

	for (dcode = 0; dcode < this.D_CODES; dcode++) {
	    out_length +=
		this.dyn_dtree[dcode].fc * (5 + this.extra_dbits[dcode]);
	}
	out_length >>= 3;
	//      Trace((stderr,"\nlast_lit %u, last_dist %u, in %ld, out ~%ld(%ld%%) ",
	//       encoder->last_lit, encoder->last_dist, in_length, out_length,
	//       100L - out_length*100L/in_length));
	if (this.last_dist < parseInt(this.last_lit / 2) &&
	    out_length < parseInt(in_length / 2))
	    return true;
    }
    return (this.last_lit == this.LIT_BUFSIZE - 1 ||
	    this.last_dist == this.DIST_BUFSIZE);
    /* We avoid equality with LIT_BUFSIZE because of wraparound at 64K
     * on 16 bit machines and because stored blocks are restricted to
     * 64K-1 bytes.
     */
}

/* ==========================================================================
   * Send the block data compressed using the given Huffman trees
   */
Deflate.prototype.compress_block = function(ltree, dtree)
{				// distance tree
    var dist;			// distance of matched string
    var lc;			// match length or unmatched char (if dist == 0)
    var lx = 0;			// running index in l_buf
    var dx = 0;			// running index in d_buf
    var fx = 0;			// running index in flag_buf
    var flag = 0;		// current flags
    var code;			// the code to send
    var extra;			// number of extra bits to send

    if (this.last_lit != 0)
	do {
	    if ((lx & 7) == 0)
		flag = this.flag_buf[fx++];
	    lc = this.l_buf[lx++] & 0xff;
	    if ((flag & 1) == 0) {
		this.SEND_CODE(lc, ltree);	/* send a literal byte */
		//      Tracecv(isgraph(lc), (stderr," '%c' ", lc));
	    } else {
		// Here, lc is the match length - MIN_MATCH
		code = this.length_code[lc];
		this.SEND_CODE(code + this.LITERALS + 1, ltree);	// send the length code
		extra = this.extra_lbits[code];
		if (extra != 0) {
		    lc -= this.base_length[code];
		    this.send_bits(lc, extra);	// send the extra length bits
		}
		dist = this.d_buf[dx++];
		// Here, dist is the match distance - 1
		code = this.D_CODE(dist);
		//      Assert (code < D_CODES, "bad d_code");

		this.SEND_CODE(code, dtree);	// send the distance code
		extra = this.extra_dbits[code];
		if (extra != 0) {
		    dist -= this.base_dist[code];
		    this.send_bits(dist, extra);	// send the extra distance bits
		}
	    }			// literal or match pair ?
	    flag >>= 1;
	} while (lx < this.last_lit);

    this.SEND_CODE(this.END_BLOCK, ltree);
}

/* ==========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
Deflate.prototype.Buf_size = 16;	// bit size of bi_buf
Deflate.prototype.send_bits = function(value, length)
{				// number of bits
    /* If not enough room in bi_buf, use (valid) bits from bi_buf and
     * (16 - bi_valid) bits from value, leaving (width - (16-bi_valid))
     * unused bits in value.
     */
    if (this.bi_valid > this.Buf_size - length) {
	this.bi_buf |= (value << this.bi_valid);
	this.put_short(this.bi_buf);
	this.bi_buf = (value >> (this.Buf_size - this.bi_valid));
	this.bi_valid += length - this.Buf_size;
    } else {
	this.bi_buf |= value << this.bi_valid;
	this.bi_valid += length;
    }
}

/* ==========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
Deflate.prototype.bi_reverse = function(code, len)
{				// its bit length
    var res = 0;
    do {
	res |= code & 1;
	code >>= 1;
	res <<= 1;
    } while (--len > 0);
    return res >> 1;
}

/* ==========================================================================
 * Write out any remaining bits in an incomplete byte.
 */
Deflate.prototype.bi_windup = function()
{
    if (this.bi_valid > 8) {
	this.put_short(this.bi_buf);
    } else if (this.bi_valid > 0) {
	this.put_byte(this.bi_buf);
    }
    this.bi_buf = 0;
    this.bi_valid = 0;
}

Deflate.prototype.qoutbuf = function()
{
    if (this.outcnt != 0) {
	var q, i;
	q = this.new_queue();
	if (this.qhead == null)
	    this.qhead = this.qtail = q;
	else
	    this.qtail = this.qtail.next = q;
	q.len = this.outcnt - this.outoff;
	//      System.arraycopy(this.outbuf, this.outoff, q.ptr, 0, q.len);
	for (i = 0; i < q.len; i++)
	    q.ptr[i] = this.outbuf[this.outoff + i];
	this.outcnt = this.outoff = 0;
    }
}

Deflate.prototype.compress = function(data, level)
{
    var i, j;

    this.deflate_data = data;
    this.deflate_pos = 0;
    if (typeof level == "undefined")
        level = this.DEFAULT_LEVEL;
    this.deflate_start(level);

    var buff = new Array(1024);
    var aout = [];
    while ((i = this.deflate_internal(buff, 0, buff.length)) > 0) {
        concatArray(aout, buff.slice(0, i));
    }
    this.deflate_data = null;	// G.C.
    return aout;
}
