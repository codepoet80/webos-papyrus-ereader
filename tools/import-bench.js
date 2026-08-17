#!/usr/bin/env node
/**
 * import-bench.js — headless regression/benchmark harness for the ePub import path.
 *
 * Loads the REAL engine sources (ZipFile, Inflate, EpubReader, HTMLParser,
 * HTMLBuffer, HTMLBook, PageFitter) and runs a full import of every book in a
 * directory, reporting per-phase timing, work counts, and correctness checks.
 *
 * What it DOES catch: parse correctness, silent truncation, chapter-boundary
 * math, defer/chunk/DB-write counts, quadratic re-parse blowups, exceptions
 * that the app would swallow inside .defer() callbacks.
 *
 * What it does NOT catch: real webOS wall-clock time.  Old JavaScriptCore has
 * wildly different per-operation costs than Node — a change that looks free
 * here can be catastrophic on a TouchPad (see IMPORT-AUDIT.html F9).  Use the
 * "defers" and "dbWrites" columns as the portable proxies for device cost, and
 * always confirm real timing on device.
 *
 * Usage:
 *   node tools/import-bench.js [booksDir] [--json out.json] [--book substr]
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var APP = path.join(__dirname, '..', 'app');
var booksDir = process.argv[2] && process.argv[2].charAt(0) !== '-'
	? process.argv[2]
	: '/Users/jonwise/Desktop/BooksToTest';

var jsonOut = null;
var bookFilter = null;
for (var ai = 2; ai < process.argv.length; ai++) {
	if (process.argv[ai] === '--json') { jsonOut = process.argv[ai + 1]; }
	if (process.argv[ai] === '--book') { bookFilter = process.argv[ai + 1]; }
}

var JSDOM = require('./jsdom-loader.js')();

// Engine load order mirrors app/depends.js.  Database.js is replaced by an
// in-memory fake; everything else is the real shipping source.
var ENGINE_FILES = [
	'src/Polyfills.js', 'src/MojoCompat.js',
	'app/common/ImportSession.js',
	'src/io/Bytes.js', 'src/io/ByteReader.js', 'src/io/File.js',
	'src/io/BitBuffer.js', 'src/io/PackedBytes.js', 'src/io/text2html.js',
	'src/io/Compression/Inflate.js', 'src/io/Compression/Deflate.js',
	'src/io/Compression/zlib.js', 'src/io/Compression/lz77.js',
	'src/io/Compression/huffcdic.js', 'src/io/Compression/ZipFile.js',
	'src/encryption/des.js', 'src/encryption/crc32.js',
	'src/encryption/sha1.js', 'src/encryption/pc1.js',
	'src/pdb/PDBRecordInfo.js', 'src/pdb/PDBFile.js', 'src/pdb/DocRecord.js',
	'src/pdb/DocReader.js', 'src/pdb/EpubReader.js',
	'src/encodings/utf8.js', 'src/encodings/windows1252.js',
	'src/encodings/encodingList.js',
	'src/library/LibraryEntry.js',
	'src/display/HTMLBuffer.js', 'src/display/HTMLBook.js',
	'src/display/HTMLParser.js', 'src/display/PageFitter.js'
];

var FAKE_DB = [
	'var __DBSTORE = {};',
	'function Database(dbname, version, callback) {',
	'  this.dbname = dbname;',
	'  if (!__DBSTORE[dbname]) { __DBSTORE[dbname] = {}; }',
	'  this.store = __DBSTORE[dbname]; this.isReady = true;',
	'  setTimeout(function () { callback(true); }, 0);',
	'}',
	'Database.makeSaneName = function (i) { return i.replace(/[^\\w]/g, "_"); };',
	'Database.prototype.read = function (name, cb) {',
	'  var v = this.store[name];',
	'  setTimeout(function () { cb(v === undefined ? null : [v]); }, 0);',
	'};',
	'Database.prototype.write = function (name, value, cb) {',
	'  this.store[name] = value; __METRICS.dbWrites++;',
	'  __METRICS.dbBytes += (value && value.length) || 0;',
	'  if (cb) { setTimeout(function () { cb(true); }, 0); }',
	'};',
	'Database.prototype.writeBatch = function (pairs, cb) {',
	'  __METRICS.dbWrites++;',
	'  for (var i = 0; i < pairs.length; i++) {',
	'    this.store[pairs[i].name] = pairs[i].value;',
	'    __METRICS.dbBytes += (pairs[i].value && pairs[i].value.length) || 0;',
	'  }',
	'  if (cb) { setTimeout(function () { cb(true); }, 0); }',
	'};',
	'Database.prototype.purgeDB = function (cb) { this.store = {}; __DBSTORE[this.dbname] = this.store; if (cb) { setTimeout(cb, 0); } };',
	'Database.prototype.dropTable = function (n, cb) { if (cb) { setTimeout(cb, 0); } };',
	'Database.prototype.vacuum = function (cb) { if (cb) { setTimeout(cb, 0); } };'
].join('\n');

function buildSandbox(metrics, settings) {
	var dom = new JSDOM('<!doctype html><html><body></body></html>');
	var sb = {};
	sb.window = sb;
	sb.document = dom.window.document;
	sb.DOMParser = dom.window.DOMParser;
	sb.Buffer = Buffer;
	sb.__METRICS = metrics;

	// Engine sources console.log liberally; keep the harness table readable.
	sb.console = {
		log: function () {}, warn: function () {}, error: function () {},
		info: function () {}, debug: function () {}
	};
	sb.enyo = {
		log: function () {},
		warn: function () { metrics.warns.push(Array.prototype.join.call(arguments, ' ')); },
		error: function () { metrics.errors.push(Array.prototype.join.call(arguments, ' ')); }
	};
	sb.$L = function (s) { return s; };

	// Count every deferred step; this is the portable proxy for the ~10ms/step
	// tax the device pays (MojoCompat defer == setTimeout(fn, 10)).
	sb.setTimeout = function (fn, ms) {
		if (typeof fn === 'function') { metrics.defers++; }
		return setTimeout(function () {
			try {
				fn();
			} catch (e) {
				// The app swallows these inside .defer(); record instead so the
				// harness can report a chain death rather than hanging silently.
				metrics.uncaught.push(e && e.stack ? e.stack : String(e));
				metrics.dead = true;
			}
		}, 0); // collapse the 10ms floor so the harness runs fast
	};
	sb.clearTimeout = clearTimeout;
	sb.setInterval = function () { return 0; };
	sb.clearInterval = function () {};

	sb.atob = function (s) { return Buffer.from(s, 'base64').toString('binary'); };
	sb.btoa = function (s) { return Buffer.from(s, 'binary').toString('base64'); };

	sb.localStorage = {
		getItem: function (k) {
			if (k === 'ereader_settings') { return JSON.stringify(settings); }
			return null;
		},
		setItem: function () {},
		removeItem: function () {}
	};

	// jsdom has no layout and no image decode; PageFitter only needs dimensions.
	sb.Image = function () { this.width = 100; this.height = 100; this._src = ''; };
	Object.defineProperty(sb.Image.prototype, 'src', {
		get: function () { return this._src; },
		set: function (v) {
			this._src = v;
			var self = this;
			setTimeout(function () { if (self.onload) { self.onload(); } }, 0);
		}
	});

	vm.createContext(sb);
	vm.runInContext(FAKE_DB, sb, { filename: 'FakeDatabase.js' });
	ENGINE_FILES.forEach(function (f) {
		var full = path.join(APP, f);
		vm.runInContext(fs.readFileSync(full, 'utf8'), sb, { filename: f });
	});

	// Minimal synchronous ByteReader over a Buffer (mirrors src/io/File.js).
	vm.runInContext([
		'function MemoryFile(buf) { this.buffer = buf; this.ready = true; }',
		'MemoryFile.prototype.read = function (start, len) {',
		'  if (start < 0 || start >= this.buffer.length || len <= 0) { return null; }',
		'  var end = Math.min(start + len, this.buffer.length);',
		'  return Array.prototype.slice.call(this.buffer.slice(start, end));',
		'};',
		'MemoryFile.prototype.readIsAsync = function () { return false; };',
		'MemoryFile.prototype.getLength = function () { return this.buffer.length; };',
		'MemoryFile.prototype.close = function () {};',
		'MemoryFile.prototype.getBasename = function () { return this._name || "test.epub"; };',
		'MemoryFile.prototype.getPathname = function () { return ""; };'
	].join('\n'), sb, { filename: 'MemoryFile.js' });

	return sb;
}

function importBook(file, settings, done) {
	var metrics = {
		defers: 0, steps: 0, dbWrites: 0, dbBytes: 0, chunks: 0,
		warns: [], errors: [], uncaught: [], dead: false
	};
	var sb = buildSandbox(metrics, settings);
	sb.__epubBuffer = fs.readFileSync(file);
	sb.__state = 'start';
	sb.__t = { t0: Date.now() };

	// Count chunk cycles without depending on the app-side ImportStats hook,
	// so the harness works on any revision.
	vm.runInContext([
		'var __origDefer = ImportSession.deferStep;',
		'ImportSession.deferStep = function (s, f) { __METRICS.steps++; return __origDefer(s, f); };',
		'var __origRFR = HTMLBook.prototype.readFromReader;',
		'HTMLBook.prototype.readFromReader = function () {',
		'  __METRICS.chunks++;',
		'  return __origRFR.apply(this, arguments);',
		'};'
	].join('\n'), sb, { filename: 'instrument.js' });

	// Run inside a session, exactly as FileImporter does, so the import path
	// under test is the real one (cancellation guards + trampoline), not the
	// unguarded book-reading path.
	vm.runInContext([
		'ImportSession.endCurrent();',
		'__session = ImportSession.begin();',
		'var memFile = new MemoryFile(__epubBuffer);',
		'var zipFile = new ZipFile(memFile);',
		'if (zipFile.error !== 0) { __state = "zip-error:" + zipFile.error; }',
		'else {',
		'  new EpubReader(zipFile, function (zip, reader) {',
		'    if (!reader) { __state = "parse-failed"; return; }',
		'    __t.parse = Date.now();',
		'    __reader = reader;',
		'    new HTMLBook(reader, false, "bench", function (book) {',
		'      if (!book || !book.isReady) { __state = "store-failed"; return; }',
		'      __t.store = Date.now();',
		'      __book = book;',
		'      __state = "ok";',
		'      ImportSession.endCurrent();',
		'    });',
		'  });',
		'}'
	].join('\n'), sb, { filename: 'run.js' });

	var deadline = Date.now() + 120000;
	var iv = setInterval(function () {
		var finished = sb.__state === 'ok' || /failed|error/.test(sb.__state);
		var stuck = metrics.dead;
		if (!finished && !stuck && Date.now() < deadline) { return; }
		clearInterval(iv);

		var t = sb.__t;
		var result = {
			file: path.basename(file),
			status: stuck ? 'CHAIN-DEATH' : (Date.now() >= deadline && !finished ? 'TIMEOUT' : sb.__state),
			ms: Date.now() - t.t0,
			parseMs: t.parse ? t.parse - t.t0 : null,
			storeMs: t.store && t.parse ? t.store - t.parse : null,
			defers: metrics.defers,
			steps: metrics.steps,
			chunks: metrics.chunks,
			dbWrites: metrics.dbWrites,
			dbKB: Math.round(metrics.dbBytes / 1024),
			uncaught: metrics.uncaught,
			warns: metrics.warns
		};

		if (sb.__reader && sb.__book) {
			var reader = sb.__reader;
			var book = sb.__book;
			var rf = reader.structure && reader.structure.rfData[0];
			result.chapters = rf ? rf.chapters.length : 0;
			result.images = rf ? rf.images.length : 0;
			result.bookLen = book.getLength();
			result.numBuffers = book.numBuffers;
			result.chapterBreaks = (book.chapterBreaks || []).length;

			// Truncation check (F8): the stored plain-text length must match the
			// filtered source. Recompute independently via the same parser the
			// storage pass uses.
			var expected = 0;
			for (var ci = 0; ci < reader.offsets.length; ci++) {
				var off = reader.offsets[ci];
				var chap = reader.structure.rfData[off.root].chapters[off.chapter];
				var parsed = sb.HTMLParser.parseBytes(chap.data, null);
				expected += parsed.plainBytes.length;
			}
			result.expectedLen = expected;
			result.truncatedBy = expected - book.getLength();
		}

		// Reopen from storage exactly as the app does when the user later taps
		// the book.  This is what proves the import actually PERSISTED: a
		// batched or interrupted write could otherwise look fine above and only
		// fail when the reader opens the book days later.
		if (result.status !== 'ok') { done(result); return; }
		sb.__reopened = undefined;
		vm.runInContext([
			'ImportSession.endCurrent();',
			'new HTMLBook(null, false, "bench", function (b) { __reopened = b || null; });'
		].join('\n'), sb, { filename: 'reopen.js' });

		var rDeadline = Date.now() + 20000;
		var riv = setInterval(function () {
			if (sb.__reopened === undefined && Date.now() < rDeadline) { return; }
			clearInterval(riv);
			var rb = sb.__reopened;
			result.reopenOk = !!(rb && rb.isReady);
			result.reopenLen = rb ? rb.getLength() : 0;
			if (!result.reopenOk) {
				result.status = 'REOPEN-FAIL';
			} else if (result.reopenLen !== result.bookLen) {
				result.status = 'REOPEN-LEN';
			}
			// Also pull the first and last stored buffer back out, so a batch
			// that silently dropped records is caught rather than assumed good.
			if (result.reopenOk && rb.numBuffers > 0) {
				sb.__b0 = undefined; sb.__bN = undefined;
				sb.__rb = rb;
				vm.runInContext([
					'__rb.loadBufferData(0, function (b) { __b0 = b || null; });',
					'__rb.loadBufferData(__rb.numBuffers - 1, function (b) { __bN = b || null; });'
				].join('\n'), sb, { filename: 'readback.js' });
				var bDeadline = Date.now() + 10000;
				var biv = setInterval(function () {
					var ready = sb.__b0 !== undefined && sb.__bN !== undefined;
					if (!ready && Date.now() < bDeadline) { return; }
					clearInterval(biv);
					result.buffersOk = !!(sb.__b0 && sb.__bN);
					if (!result.buffersOk) { result.status = 'BUFFER-FAIL'; }
					done(result);
				}, 5);
				return;
			}
			done(result);
		}, 5);
	}, 5);
}

function pad(s, n) { s = String(s); return s + new Array(Math.max(1, n - s.length + 1)).join(' '); }
function padL(s, n) { s = String(s); return new Array(Math.max(1, n - s.length + 1)).join(' ') + s; }

function main() {
	if (!fs.existsSync(booksDir)) {
		console.error('No such directory: ' + booksDir);
		process.exit(2);
	}
	var books = fs.readdirSync(booksDir)
		.filter(function (f) { return /\.epub$/i.test(f); })
		.filter(function (f) { return !bookFilter || f.toLowerCase().indexOf(bookFilter.toLowerCase()) !== -1; })
		.map(function (f) { return path.join(booksDir, f); });

	if (!books.length) { console.error('No .epub files found in ' + booksDir); process.exit(2); }

	var settingsVariants = [
		{ label: 'breaks-OFF', settings: { chapterPageBreaks: false } },
		{ label: 'breaks-ON', settings: { chapterPageBreaks: true } }
	];

	var results = [];
	var queue = [];
	books.forEach(function (b) {
		settingsVariants.forEach(function (v) { queue.push({ book: b, variant: v }); });
	});

	console.log('\nPapyrus import bench — ' + books.length + ' book(s), ' +
		settingsVariants.length + ' config(s)');
	console.log('engine: real sources from ' + path.relative(process.cwd(), APP));
	console.log('NOTE: ms is Node time, NOT device time. Compare defers/dbWrites for device cost.\n');

	var header = pad('book', 34) + pad('config', 12) + pad('status', 12) +
		padL('ms', 7) + padL('timers', 8) + padL('steps', 8) + padL('chunks', 8) +
		padL('writes', 8) + padL('chaps', 7) + padL('breaks', 8) + padL('trunc', 8) + padL('reopen', 8);
	console.log(header);
	console.log(new Array(header.length + 1).join('-'));

	function next() {
		if (!queue.length) { finish(); return; }
		var job = queue.shift();
		importBook(job.book, job.variant.settings, function (r) {
			r.config = job.variant.label;
			results.push(r);
			var truncFlag = r.truncatedBy === undefined ? '-'
				: (r.truncatedBy === 0 ? 'ok' : String(r.truncatedBy));
			console.log(
				pad(r.file.slice(0, 33), 34) + pad(r.config, 12) + pad(r.status, 12) +
				padL(r.ms, 7) + padL(r.defers, 8) + padL(r.steps, 8) + padL(r.chunks, 8) +
				padL(r.dbWrites, 8) + padL(r.chapters === undefined ? '-' : r.chapters, 7) +
				padL(r.chapterBreaks === undefined ? '-' : r.chapterBreaks, 8) +
				padL(truncFlag, 8) +
				padL(r.reopenOk === undefined ? '-' : (r.reopenOk && r.buffersOk !== false ? 'ok' : 'FAIL'), 8)
			);
			if (r.uncaught && r.uncaught.length) {
				console.log('    !! uncaught in defer chain: ' + r.uncaught[0].split('\n')[0]);
			}
			next();
		});
	}

	function finish() {
		var bad = results.filter(function (r) {
			return r.status !== 'ok' || (r.truncatedBy && r.truncatedBy !== 0) ||
				r.reopenOk === false || r.buffersOk === false;
		});
		console.log('');
		if (bad.length) {
			console.log('FAILURES (' + bad.length + '):');
			bad.forEach(function (r) {
				console.log('  ' + r.file + ' [' + r.config + '] status=' + r.status +
					(r.truncatedBy ? ' truncatedBy=' + r.truncatedBy + ' bytes' : ''));
				(r.uncaught || []).forEach(function (u) {
					console.log('      ' + u.split('\n').slice(0, 3).join('\n      '));
				});
			});
		} else {
			console.log('All books imported cleanly, no truncation.');
		}

		// Surface notable engine warnings, collapsed to ONE line per kind per
		// book. A book with 36 broken images should read as a single fact, not
		// 36 lines that bury the results table.
		var noteSeen = {};
		results.forEach(function (r) {
			(r.warns || []).forEach(function (w) {
				if (!/skipping|invalid|too large|giant|larger than/i.test(w)) { return; }
				// Key on the message, not its subject, so per-file detail collapses.
				var kind = w.split(':')[0].trim();
				var key = r.file + '|' + kind;
				noteSeen[key] = (noteSeen[key] || 0) + 1;
			});
		});
		var noteKeys = Object.keys(noteSeen);
		if (noteKeys.length) {
			console.log('');
			console.log('Engine notes (informational):');
			noteKeys.forEach(function (k) {
				var parts = k.split('|');
				console.log('  ' + parts[0].slice(0, 34) + '  ' + parts[1] +
					'  (x' + noteSeen[k] + ' across configs)');
			});
		}

		if (jsonOut) {
			fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));
			console.log('\nwrote ' + jsonOut);
		}
		process.exit(bad.length ? 1 : 0);
	}

	next();
}

main();
