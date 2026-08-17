#!/usr/bin/env node
/**
 * pwa-safari-test.js — exercises the PWA import path in real Safari (WebKit).
 *
 * The webOS harnesses (import-bench.js / import-cancel-test.js) run the engine
 * under Node with a fake Database.  This one runs the SHIPPING app in a real
 * browser, so it covers what those cannot:
 *
 *   - the browser import pipeline (_importEpubFromBrowserFile /
 *     importEpubFromUrl / _processEpubArrayBuffer), which is a separate code
 *     path from the webOS one and must stay in sync with it
 *   - the real WebSQL -> IndexedDB shim in webos-compat.js
 *   - real WebKit, which is what iOS PWA users actually get
 *
 * Prerequisites (one time):
 *   Safari > Settings > Developer > enable "Allow remote automation"
 *   (the Develop menu itself is enabled under Settings > Advanced)
 *
 * Usage:
 *   node tools/pwa-safari-test.js [baseUrl]
 *   default baseUrl: http://localhost:8777/app/index.html
 *
 * Serve the app first, e.g.:
 *   cp -R app /tmp/pwatest/app && cp some.epub /tmp/pwatest/app/testbook.epub
 *   (cd /tmp/pwatest && python3 -m http.server 8777)
 */

var http = require('http');
var cp = require('child_process');

var BASE = process.argv[2] || 'http://localhost:8777/app/index.html';
var PORT = 4599;
var driver = null;
var sessionId = null;
var failures = [];

function req(method, path, body) {
	return new Promise(function (resolve, reject) {
		var data = body ? JSON.stringify(body) : null;
		var r = http.request({
			host: 'localhost', port: PORT, path: path, method: method,
			headers: data
				? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
				: {}
		}, function (res) {
			var chunks = '';
			res.on('data', function (c) { chunks += c; });
			res.on('end', function () {
				var parsed;
				try { parsed = JSON.parse(chunks); } catch (e) { parsed = { raw: chunks }; }
				resolve({ status: res.statusCode, body: parsed });
			});
		});
		r.on('error', reject);
		if (data) { r.write(data); }
		r.end();
	});
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function check(name, ok, detail) {
	console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '   (' + detail + ')' : ''));
	if (!ok) { failures.push(name); }
}

/** Runs an async script in the page. The script must call its last arg with a result. */
async function execAsync(script, args, timeoutNote) {
	var res = await req('POST', '/session/' + sessionId + '/execute/async',
		{ script: script, args: args || [] });
	if (res.body && res.body.value && res.body.value.error) {
		throw new Error((timeoutNote || 'script') + ': ' + res.body.value.error +
			' — ' + (res.body.value.message || '').split('\n')[0]);
	}
	return res.body.value;
}

async function main() {
	console.log('\nPWA import test — real Safari/WebKit');
	console.log('target: ' + BASE + '\n');

	// ------------------------------------------------------------ driver up
	driver = cp.spawn('safaridriver', ['-p', String(PORT)], { stdio: 'ignore', detached: true });
	await sleep(2500);

	var s = await req('POST', '/session', {
		capabilities: { alwaysMatch: { browserName: 'safari' } }
	});
	if (!s.body || !s.body.value || !s.body.value.sessionId) {
		var msg = (s.body && s.body.value && s.body.value.message) || JSON.stringify(s.body);
		console.error('Could not start Safari WebDriver session.\n');
		console.error('  ' + msg + '\n');
		if (/remote automation/i.test(msg)) {
			console.error('Fix: Safari > Settings > Developer > tick "Allow remote automation".');
			console.error('(Develop menu is enabled under Safari > Settings > Advanced.)\n');
		}
		process.exit(2);
	}
	sessionId = s.body.value.sessionId;

	// Async scripts need a generous ceiling: importing a 3.6MB book is slow.
	await req('POST', '/session/' + sessionId + '/timeouts', { script: 180000 });

	// ------------------------------------------------------------- load app
	await req('POST', '/session/' + sessionId + '/url', { url: BASE });

	var ready = await execAsync(
		'var done = arguments[arguments.length - 1];' +
		'var t0 = Date.now();' +
		'(function poll() {' +
		'  var haveApp = typeof FileImporter !== "undefined" &&' +
		'                typeof ImportSession !== "undefined" &&' +
		'                typeof HTMLBook !== "undefined";' +
		'  if (haveApp) { done({ ok: true, ms: Date.now() - t0 }); return; }' +
		'  if (Date.now() - t0 > 40000) { done({ ok: false, ms: Date.now() - t0 }); return; }' +
		'  setTimeout(poll, 200);' +
		'})();', [], 'app load');
	check('app loads and defines the import classes', !!(ready && ready.ok),
		ready ? (ready.ms + 'ms') : 'no result');
	if (!ready || !ready.ok) { return; }

	// Surface page errors that would otherwise be invisible.
	await execAsync(
		'var done = arguments[arguments.length - 1];' +
		'window.__pwaErrors = [];' +
		'window.addEventListener("error", function (e) { window.__pwaErrors.push(String(e.message)); });' +
		'var ow = enyo.warn, oe = enyo.error;' +
		'window.__pwaWarns = [];' +
		'enyo.warn = function () { window.__pwaWarns.push(Array.prototype.join.call(arguments, " ")); return ow.apply(this, arguments); };' +
		'enyo.error = function () { window.__pwaErrors.push(Array.prototype.join.call(arguments, " ")); return oe.apply(this, arguments); };' +
		'done(true);');

	// --------------------------------------------------------- import a book
	var imported = await execAsync(
		'var done = arguments[arguments.length - 1];' +
		'var url = arguments[0], name = arguments[1];' +
		'var t0 = Date.now();' +
		'try {' +
		'  new FileImporter().importEpubFromUrl(url, name, function (book, err) {' +
		'    done({ ok: !!book && !err, err: err || null, ms: Date.now() - t0,' +
		'           title: book ? book.title : null, dbName: book ? book.bookDbName : null,' +
		'           bytes: book ? book.bookByteLength : 0 });' +
		'  }, function () {});' +
		'} catch (e) { done({ ok: false, err: "threw: " + (e.message || e) }); }',
		['testbook.epub', 'testbook.epub'], 'import');

	check('PWA imports a book end to end', !!(imported && imported.ok),
		imported ? (imported.err ? imported.err : imported.ms + 'ms, ' + imported.bytes + ' bytes') : 'no result');

	// ------------------------------------------- reopen it from storage
	if (imported && imported.ok) {
		var reopened = await execAsync(
			'var done = arguments[arguments.length - 1];' +
			'var dbName = arguments[0];' +
			'try {' +
			'  new HTMLBook(null, false, dbName, function (b) {' +
			'    done({ ok: !!(b && b.isReady), len: b ? b.getLength() : 0, buffers: b ? b.numBuffers : 0 });' +
			'  });' +
			'} catch (e) { done({ ok: false, err: String(e) }); }',
			[imported.dbName], 'reopen');
		check('imported book reopens from IndexedDB storage', !!(reopened && reopened.ok),
			reopened ? (reopened.len + ' bytes, ' + reopened.buffers + ' buffers') : 'no result');
		check('reopened length matches imported length',
			!!(reopened && reopened.len === imported.bytes),
			reopened ? (reopened.len + ' vs ' + imported.bytes) : 'n/a');
	}

	// ------------------------------------------------ single-flight + cancel
	var lock = await execAsync(
		'var done = arguments[arguments.length - 1];' +
		'ImportSession.endCurrent();' +
		'var a = ImportSession.begin();' +
		'var b = ImportSession.begin();' +
		'a.cancel("test");' +
		'var afterCancel = ImportSession.current;' +
		'var c = ImportSession.begin();' +
		'if (c) { ImportSession.endCurrent(); }' +
		'done({ first: !!a, secondRefused: b === null, released: afterCancel === null, restartable: !!c });');
	check('single-flight lock refuses a concurrent import', !!(lock && lock.secondRefused));
	check('cancel releases the lock in the browser too', !!(lock && lock.released));
	check('a new import can start after cancel', !!(lock && lock.restartable));

	// --------------------------------------- a second import still works
	var second = await execAsync(
		'var done = arguments[arguments.length - 1];' +
		'ImportSession.endCurrent();' +
		'try {' +
		'  new FileImporter().importEpubFromUrl(arguments[0], arguments[1], function (book, err) {' +
		'    done({ ok: !!book && !err, err: err || null, title: book ? book.title : null });' +
		'  }, function () {});' +
		'} catch (e) { done({ ok: false, err: "threw: " + (e.message || e) }); }',
		['testbook2.epub', 'testbook2.epub'], 'second import');
	check('a second, different book imports after the first', !!(second && second.ok),
		second ? (second.err || second.title) : 'no result');

	// ------------------------------------------------------------- diagnostics
	var diag = await execAsync(
		'var done = arguments[arguments.length - 1];' +
		'done({ errors: (window.__pwaErrors || []).slice(0, 8),' +
		'       stats: (window.__pwaWarns || []).filter(function (w) { return w.indexOf("IMPORTSTATS") === 0; }) });');
	check('no uncaught page errors during import',
		!!(diag && diag.errors && diag.errors.length === 0),
		diag && diag.errors && diag.errors.length ? diag.errors[0] : 'none');

	if (diag && diag.stats && diag.stats.length) {
		console.log('\nIMPORTSTATS from the browser run:');
		diag.stats.forEach(function (l) { console.log('  ' + l); });
	}
}

main()
	.catch(function (e) {
		console.error('\nharness error: ' + (e && e.message ? e.message : e));
		failures.push('harness error');
	})
	.then(async function () {
		try { if (sessionId) { await req('DELETE', '/session/' + sessionId); } } catch (e) {}
		try { if (driver) { process.kill(-driver.pid); } } catch (e) {}
		console.log('');
		if (failures.length) {
			console.log('PWA TESTS FAILED (' + failures.length + '): ' + failures.join('; '));
			process.exit(1);
		}
		console.log('ALL PWA TESTS PASSED');
		process.exit(0);
	});
