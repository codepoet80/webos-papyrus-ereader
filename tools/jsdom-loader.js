/**
 * jsdom-loader.js — locates jsdom for the import test harnesses.
 *
 * This repo deliberately keeps node tooling out of git (.gitignore excludes
 * package.json and node_modules), so the harnesses cannot rely on a committed
 * dependency manifest.  They look for jsdom in the usual places instead and,
 * failing that, tell you exactly how to install it rather than dying with a
 * bare MODULE_NOT_FOUND.
 *
 * The one-command path is tools/run-tests.sh, which installs it for you.
 */

var path = require('path');
var Module = require('module');

module.exports = function loadJSDOM() {
	var candidates = [
		// installed by tools/run-tests.sh (gitignored)
		path.join(__dirname, 'node_modules'),
		// a repo-root install, if someone prefers that
		path.join(__dirname, '..', 'node_modules')
	];

	// Let these locations participate in resolution, then fall back to
	// whatever the normal require path already offers (global installs,
	// NODE_PATH, etc.).
	candidates.forEach(function (dir) {
		if (Module.globalPaths.indexOf(dir) === -1) { Module.globalPaths.push(dir); }
	});

	var tried = [];
	var attempts = candidates.map(function (d) { return path.join(d, 'jsdom'); });
	attempts.push('jsdom');

	for (var i = 0; i < attempts.length; i++) {
		try {
			return require(attempts[i]).JSDOM;
		} catch (e) {
			tried.push(attempts[i]);
		}
	}

	console.error('');
	console.error('jsdom is required by this harness but was not found.');
	console.error('');
	console.error('  Easiest:   ./tools/run-tests.sh        (installs it, then runs everything)');
	console.error('  Manual:    npm install --prefix tools --no-save jsdom');
	console.error('');
	console.error('Looked in:');
	tried.forEach(function (t) { console.error('  ' + t); });
	console.error('');
	process.exit(2);
};
