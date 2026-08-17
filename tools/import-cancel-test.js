#!/usr/bin/env node
/**
 * import-cancel-test.js — proves the import pipeline is actually killable.
 *
 * This is the automated form of the "zombie test" from IMPORT-REWORK-PLAN.md
 * P1.5: cancel a running import and verify the defer chain STOPS, rather than
 * continuing to parse and write in the background (audit F1).  It also proves
 * that a step which throws is reported through the session instead of silently
 * killing the chain and hanging forever (audit F2).
 *
 * Usage: node tools/import-cancel-test.js [book.epub]
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var APP = path.join(__dirname, '..', 'app');
var book = process.argv[2] ||
	'/Users/jonwise/Desktop/BooksToTest/Being Human - Star Trek_ New Frontier 12 - Peter David.epub';

var JSDOM = require('./jsdom-loader.js')();

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
	'src/encodings/encodingList.js', 'src/library/LibraryEntry.js',
	'src/display/HTMLBuffer.js', 'src/display/HTMLBook.js',
	'src/display/HTMLParser.js'
];

var FAKE_DB = [
	'function Database(dbname, version, callback) {',
	'  this.dbname = dbname; this.store = {}; this.isReady = true;',
	'  setTimeout(function () { callback(true); }, 0);',
	'}',
	'Database.makeSaneName = function (i) { return i.replace(/[^\\w]/g, "_"); };',
	'Database.prototype.read = function (name, cb) { var v = this.store[name];',
	'  setTimeout(function () { cb(v === undefined ? null : [v]); }, 0); };',
	'Database.prototype.write = function (name, value, cb) { this.store[name] = value;',
	'  __M.dbWrites++; if (cb) { setTimeout(function () { cb(true); }, 0); } };',
	'Database.prototype.writeBatch = function (pairs, cb) { __M.dbWrites++;',
	'  for (var i = 0; i < pairs.length; i++) { this.store[pairs[i].name] = pairs[i].value; }',
	'  if (cb) { setTimeout(function () { cb(true); }, 0); } };',
	'Database.prototype.purgeDB = function (cb) { this.store = {}; if (cb) { setTimeout(cb, 0); } };'
].join('\n');

function build(metrics) {
	var dom = new JSDOM('<!doctype html><html><body></body></html>');
	var sb = {};
	sb.window = sb;
	sb.document = dom.window.document;
	sb.DOMParser = dom.window.DOMParser;
	sb.Buffer = Buffer;
	sb.__M = metrics;
	sb.console = { log: function () {}, warn: function () {}, error: function () {} };
	sb.enyo = {
		log: function () {}, warn: function () {},
		error: function () { metrics.errors.push(Array.prototype.join.call(arguments, ' ')); }
	};
	sb.$L = function (s) { return s; };
	sb.setTimeout = function (fn, ms) {
		metrics.defers++;
		return setTimeout(function () {
			try { fn(); } catch (e) { metrics.uncaught.push(String(e)); }
		}, 0);
	};
	sb.clearTimeout = clearTimeout;
	sb.setInterval = function () { return 0; };
	sb.clearInterval = function () {};
	sb.atob = function (s) { return Buffer.from(s, 'base64').toString('binary'); };
	sb.btoa = function (s) { return Buffer.from(s, 'binary').toString('base64'); };
	sb.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
	sb.Image = function () { this.width = 100; this.height = 100; };
	Object.defineProperty(sb.Image.prototype, 'src', {
		get: function () { return this._s; },
		set: function (v) { this._s = v; var s = this; setTimeout(function () { if (s.onload) { s.onload(); } }, 0); }
	});
	vm.createContext(sb);
	vm.runInContext(FAKE_DB, sb, { filename: 'FakeDatabase.js' });
	ENGINE_FILES.forEach(function (f) {
		vm.runInContext(fs.readFileSync(path.join(APP, f), 'utf8'), sb, { filename: f });
	});
	vm.runInContext([
		'var __origDefer = ImportSession.deferStep;',
		'ImportSession.deferStep = function (s, f) {',
		'  return __origDefer(s, function () { __M.stepsRun++; f(); });',
		'};'
	].join('\n'), sb, { filename: 'count-steps.js' });
	vm.runInContext([
		'function MemoryFile(b) { this.buffer = b; this.ready = true; }',
		'MemoryFile.prototype.read = function (s, l) {',
		'  if (s < 0 || s >= this.buffer.length || l <= 0) { return null; }',
		'  return Array.prototype.slice.call(this.buffer.slice(s, Math.min(s + l, this.buffer.length))); };',
		'MemoryFile.prototype.readIsAsync = function () { return false; };',
		'MemoryFile.prototype.getLength = function () { return this.buffer.length; };',
		'MemoryFile.prototype.close = function () {};',
		'MemoryFile.prototype.getBasename = function () { return "t.epub"; };',
		'MemoryFile.prototype.getPathname = function () { return ""; };'
	].join('\n'), sb, { filename: 'MemoryFile.js' });
	return sb;
}

var failures = [];
function check(name, ok, detail) {
	console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   (' + detail + ')' : ''));
	if (!ok) { failures.push(name); }
}

var buf = fs.readFileSync(book);
console.log('\nImport cancellation tests — ' + path.basename(book) + '\n');

// ---------------------------------------------------------------- test 1
// Cancel mid-import; the chain must stop scheduling new steps.
function testCancel(next) {
	var m = { defers: 0, stepsRun: 0, dbWrites: 0, errors: [], uncaught: [] };
	var sb = build(m);
	sb.__buf = buf;
	sb.__done = false;
	sb.__completed = false;

	vm.runInContext([
		'__session = ImportSession.begin();',
		'new EpubReader(new ZipFile(new MemoryFile(__buf)), function (zip, reader) {',
		'  if (!reader) { __done = true; return; }',
		'  new HTMLBook(reader, false, "cancel", function (book) {',
		'    __completed = true; __done = true;',
		'  });',
		'});'
	].join('\n'), sb, { filename: 'run.js' });

	// Let it get properly underway, then cancel.
	setTimeout(function () {
		var atCancel = { defers: m.defers, steps: m.stepsRun, writes: m.dbWrites };
		vm.runInContext('__session.cancel("test");', sb, { filename: 'cancel.js' });

		// Give the chain a generous window to prove it is dead.
		setTimeout(function () {
			var after = { defers: m.defers, steps: m.stepsRun, writes: m.dbWrites };
			var newSteps = after.steps - atCancel.steps;
			var newWrites = after.writes - atCancel.writes;

			check('chain was actually running when cancelled', atCancel.steps > 20,
				atCancel.steps + ' steps before cancel');
			// A couple of already-queued timers may still fire; the chain must
			// not keep SCHEDULING work.  Allow a small settle margin.
			check('chain stops running steps after cancel', newSteps <= 3,
				newSteps + ' steps ran after cancel');
			check('no database writes after cancel', newWrites === 0,
				newWrites + ' writes after cancel');
			check('import did not complete after cancel', !sb.__completed);
			check('ImportSession.current released by caller contract',
				sb.__session.cancelled === true);
			next();
		}, 700);
	}, 120);
}

// ---------------------------------------------------------------- test 2
// A step that throws must surface through session.fail, not vanish.
function testThrow(next) {
	var m = { defers: 0, stepsRun: 0, dbWrites: 0, errors: [], uncaught: [] };
	var sb = build(m);
	sb.__buf = buf;
	sb.__failReason = null;
	sb.__completed = false;

	vm.runInContext([
		'__session = ImportSession.begin();',
		'__session.onFail = function (r) { __failReason = r; };',
		// Poison a mid-chain step so it throws the way a real parser bug would.
		'var origFilter = EpubReader.prototype.filterChapter;',
		'var n = 0;',
		'EpubReader.prototype.filterChapter = function () {',
		'  if (++n === 3) { throw new Error("synthetic parser failure"); }',
		'  return origFilter.apply(this, arguments);',
		'};',
		'new EpubReader(new ZipFile(new MemoryFile(__buf)), function (zip, reader) {',
		'  if (!reader) { return; }',
		'  new HTMLBook(reader, false, "throw", function () { __completed = true; });',
		'});'
	].join('\n'), sb, { filename: 'run.js' });

	setTimeout(function () {
		check('thrown step reported via session.onFail', !!sb.__failReason,
			sb.__failReason ? ('"' + sb.__failReason + '"') : 'never reported');
		check('thrown step did not escape as an uncaught error',
			m.uncaught.length === 0, m.uncaught.length + ' uncaught');
		check('failed import does not silently "complete"', !sb.__completed);
		next();
	}, 900);
}

// --------------------------------------------------------------- test 2b
// After a cancel, a NEW import must be startable.  A silent cancel never runs
// the per-import completion callback, so if cancel() does not release the
// single-flight slot itself the lock is stranded and every later import is
// refused until the app restarts.  This shipped once; keep the test.
function testCancelReleasesLock(next) {
	var m = { defers: 0, stepsRun: 0, dbWrites: 0, errors: [], uncaught: [] };
	var sb = build(m);
	sb.__buf = buf;
	sb.__completed = false;
	sb.__second = null;

	vm.runInContext([
		'ImportSession.endCurrent();',
		'__session = ImportSession.begin();',
		'new EpubReader(new ZipFile(new MemoryFile(__buf)), function (zip, reader) {',
		'  if (!reader) { return; }',
		'  new HTMLBook(reader, false, "lock", function () { __completed = true; });',
		'});'
	].join('\n'), sb, { filename: 'run.js' });

	setTimeout(function () {
		vm.runInContext('__session.cancel("user cancelled");', sb, { filename: 'cancel.js' });
		setTimeout(function () {
			vm.runInContext('__afterCancelCurrent = ImportSession.current; __second = ImportSession.begin();',
				sb, { filename: 'restart.js' });
			check('cancel releases ImportSession.current',
				sb.__afterCancelCurrent === null,
				sb.__afterCancelCurrent === null ? 'released' : 'STILL HELD');
			check('a new import can be started after a cancel', !!sb.__second);
			check('the new session is a different object', sb.__second !== sb.__session);
			next();
		}, 300);
	}, 120);
}

// ---------------------------------------------------------------- test 3
// Single-flight: a second begin() while one is live must be refused.
function testSingleFlight(next) {
	var m = { defers: 0, stepsRun: 0, dbWrites: 0, errors: [], uncaught: [] };
	var sb = build(m);
	vm.runInContext([
		'__a = ImportSession.begin();',
		'__b = ImportSession.begin();',
		'ImportSession.endCurrent();',
		'__c = ImportSession.begin();'
	].join('\n'), sb, { filename: 'sf.js' });
	check('first begin() returns a session', !!sb.__a);
	check('second concurrent begin() is refused', sb.__b === null);
	check('begin() works again after endCurrent()', !!sb.__c);
	next();
}

// ---------------------------------------------------------------- test 4
// No session (book reading) must be completely unaffected.
function testReadPathUnguarded(next) {
	var m = { defers: 0, stepsRun: 0, dbWrites: 0, errors: [], uncaught: [] };
	var sb = build(m);
	sb.__buf = buf;
	sb.__done = false;
	sb.__completed = false;
	vm.runInContext([
		'ImportSession.endCurrent();',           // ensure no active import
		'new EpubReader(new ZipFile(new MemoryFile(__buf)), function (zip, reader) {',
		'  if (!reader) { __done = true; return; }',
		'  __capturedNull = (reader.importSession === null);',
		'  new HTMLBook(reader, false, "read", function (book) {',
		'    __completed = !!(book && book.isReady); __done = true;',
		'  });',
		'});'
	].join('\n'), sb, { filename: 'read.js' });

	var deadline = Date.now() + 30000;
	var iv = setInterval(function () {
		if (!sb.__done && Date.now() < deadline) { return; }
		clearInterval(iv);
		check('reader with no active import captures a null session', sb.__capturedNull === true);
		check('read path still completes normally', sb.__completed === true);
		next();
	}, 10);
}

testCancel(function () {
	console.log('');
	testCancelReleasesLock(function () {
	console.log('');
	testThrow(function () {
		console.log('');
		testSingleFlight(function () {
			console.log('');
			testReadPathUnguarded(function () {
				console.log('');
				if (failures.length) {
					console.log('FAILED (' + failures.length + '): ' + failures.join('; '));
					process.exit(1);
				}
				console.log('All cancellation/error-handling tests passed.');
				process.exit(0);
			});
		});
	});
	});
});
