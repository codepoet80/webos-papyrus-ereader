/**
 * PapyrusDictionary - online dictionary look-up helper
 *
 * Looks a single word up through our own proxy at papyrus.wosa.link.  The
 * response is an array of entries; we hand the first entry back to the caller.
 *
 * Why a proxy?  This used to call https://api.dictionaryapi.dev directly.  In
 * August 2026 that service's origin server stopped answering — Cloudflare kept
 * serving stale cached entries while every uncached word timed out, so common
 * words appeared to work and everything else hung.  A free API dying under a
 * legacy client is not a one-off (the same thing happened to AccuWeather's XML
 * API), and webOS devices cannot be counted on to ever be updated again.  So
 * lookups go through dictionary.php in this repo, which queries Datamuse, falls
 * back to Wiktionary, caches on disk, and emits this same response shape.  When
 * the next provider dies, that one server-side file changes and installed copies
 * of Papyrus keep working untouched.
 *
 * Follows the same raw-XMLHttpRequest idiom as SyncManager.js (no fetch / no
 * Promises — those are unavailable on webOS old WebKit).  webOS native apps
 * run from file://, so we set Origin: null (see the long note in
 * SyncManager._doPut) and retry once on status 0 (cold TLS / CORS preflight).
 *
 * lookup(word, callback):
 *   callback(errorType, entry)
 *     errorType === null      -> success, entry is the first result object
 *     errorType === "notfound"-> no definition (HTTP 404)
 *     errorType === "network" -> could not reach the dictionary (status 0)
 *     errorType === "error"   -> any other unexpected HTTP status
 */
var PapyrusDictionary = {

	API_HOST: "papyrus.wosa.link/dictionary.php",

	// webOS deliberately uses plain http: TouchPads that were never patched for
	// modern TLS can still reach it, and definitions are public, non-personal
	// data — there is nothing here worth protecting in transit.  Elsewhere we
	// match the page's own scheme: the PWA is served from this same host, so
	// that keeps the request same-origin, and an http:// call from an https://
	// page would be blocked outright as mixed content.
	_baseUrl: function() {
		if (typeof window !== "undefined" && window.PalmSystem) {
			return "http://" + this.API_HOST;
		}
		var proto = (typeof location !== "undefined" && location.protocol === "http:")
			? "http:" : "https:";
		return proto + "//" + this.API_HOST;
	},

	lookup: function(word, callback) {
		if (!word) {
			callback("notfound", null);
			return;
		}
		var clean = String(word)
			// ePubs typeset apostrophes as U+2019, not ASCII "'".  The proxy folds
			// these too, but doing it here as well keeps the cache key identical
			// whichever form the book used.
			.replace(/[‘’ʼ′]/g, "'")
			.replace(/[‐‑]/g, "-")
			.toLowerCase()
			// Blacklist, not whitelist.  An [a-z] whitelist strips accents and
			// silently turns one word into a DIFFERENT one — "naïve" became
			// "nave", the body of a church.  This is the same character class
			// EpubRenderer._expandWord already uses to find the word.
			.replace(/[^A-Za-z0-9À-ɏ'\-]/g, "");
		if (!clean) {
			callback("notfound", null);
			return;
		}
		this._doGet(clean, false, callback);
	},

	_doGet: function(word, isRetry, callback) {
		var self = this;
		var url = this._baseUrl() + "?w=" + encodeURIComponent(word);
		var xhr = new XMLHttpRequest();
		xhr.open('GET', url, true);
		// See SyncManager._doPut for why Origin: null (webOS file:// origin).
		try { xhr.setRequestHeader('Origin', 'null'); } catch (e) {}
		xhr.onreadystatechange = function() {
			if (xhr.readyState !== 4) return;
			var status = xhr.status;
			console.log("Dictionary: GET " + word + " status=" + status);

			if (status === 200) {
				var entry = self._parseFirstEntry(xhr.responseText);
				if (entry) {
					callback(null, entry);
				} else {
					callback("notfound", null);
				}
				return;
			}
			if (status === 404) {
				callback("notfound", null);
				return;
			}
			if (status === 0 && !isRetry) {
				// Cold TLS handshake / CORS preflight can return 0 on first hit
				// (same failure mode SyncManager retries).  Try once more.
				console.log("Dictionary: status 0, retrying once in 2s");
				setTimeout(function() { self._doGet(word, true, callback); }, 2000);
				return;
			}
			if (status === 0) {
				callback("network", null);
				return;
			}
			callback("error", null);
		};
		try {
			xhr.send();
		} catch (e) {
			console.log("Dictionary: send() threw: " + e);
			callback("network", null);
		}
	},

	_parseFirstEntry: function(responseText) {
		try {
			var data = JSON.parse(responseText);
			if (data && data.length && data[0] && data[0].meanings) {
				return data[0];
			}
		} catch (e) {
			console.log("Dictionary: parse error: " + e);
		}
		return null;
	}
};
