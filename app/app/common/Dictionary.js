/**
 * PapyrusDictionary - online dictionary look-up helper
 *
 * Looks a single word up against the free, CORS-enabled Dictionary API
 * (https://dictionaryapi.dev).  No API key is required.  The response is an
 * array of entries; we hand the first entry back to the caller.
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

	API_BASE: "https://api.dictionaryapi.dev/api/v2/entries/en/",

	lookup: function(word, callback) {
		if (!word) {
			callback("notfound", null);
			return;
		}
		var clean = String(word).toLowerCase().replace(/[^a-z0-9'\-]/gi, "");
		if (!clean) {
			callback("notfound", null);
			return;
		}
		this._doGet(clean, false, callback);
	},

	_doGet: function(word, isRetry, callback) {
		var self = this;
		var url = this.API_BASE + encodeURIComponent(word);
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
