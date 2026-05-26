/**
 * PapyrusSyncManager - Reading position sync via WebDAV
 *
 * Stores per-book position files at {webdavUrl}/.papyrus/{syncKey}.json
 * Uses XHR with Basic auth for WebDAV sync.
 * Push happens on book close; pull happens on book open.
 */
var PapyrusSyncManager = {

    // Derive a stable, filesystem-safe sync key.
    //
    // Primary key (when identifier is present):
    //   The ePub's dc:identifier value (typically an ISBN or UUID), normalised
    //   to lowercase alphanumeric+underscore.  ISBN example:
    //     "urn:isbn:9780062892058" → "isbn_9780062892058"
    //   This is the same in every copy of the same ePub file regardless of
    //   device, filename, or metadata quality.
    //
    // Fallback key (no identifier, or identifier looks like a bare random UUID):
    //   title + author slug, same normalisation as before.
    makeSyncKey: function(title, author, identifier) {
        if (identifier) {
            var id = identifier.trim()
                .replace(/^urn:isbn:/i,  'isbn_')
                .replace(/^urn:uuid:/i,  'uuid_')
                .replace(/^urn:/i,       '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '');
            if (id && id.length >= 4) return id.substring(0, 80);
        }

        // Fallback: title + author slug
        var raw = ((title || 'unknown') + '_' + (author || 'unknown'))
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/, '');

        raw = raw.replace(/^(the|a|an)_/, '');

        var noiseSuffixes = ['_unknown_author', '_unknown', '_ebook', '_epub'];
        var changed;
        do {
            changed = false;
            for (var i = 0; i < noiseSuffixes.length; i++) {
                var suffix = noiseSuffixes[i];
                if (raw.length > suffix.length && raw.slice(-suffix.length) === suffix) {
                    raw = raw.slice(0, -suffix.length);
                    changed = true;
                    break;
                }
            }
        } while (changed);

        return (raw.substring(0, 80)) || 'unknown_book';
    },

    // Legacy key (title+author only) — used as pull fallback for books imported
    // before epubIdentifier was stored.
    makeLegacySyncKey: function(title, author) {
        return this.makeSyncKey(title, author, null);
    },

    getSettings: function() {
        try {
            var s = JSON.parse(localStorage.getItem("ereader_settings") || "{}");
            return {
                syncEnabled: s.syncEnabled || false,
                syncUrl:     s.syncUrl     || "",
                syncUser:    s.syncUser    || "",
                syncPass:    s.syncPass    || ""
            };
        } catch(e) {
            return { syncEnabled: false, syncUrl: "", syncUser: "", syncPass: "" };
        }
    },

    _basicAuth: function(user, pass) {
        try {
            return 'Basic ' + btoa((user || '') + ':' + (pass || ''));
        } catch(e) {
            return 'Basic ' + btoa(unescape(encodeURIComponent((user || '') + ':' + (pass || ''))));
        }
    },

    _baseUrl: function(settings) {
        var url = (settings.syncUrl || "").trim();
        if (url && url.charAt(url.length - 1) !== '/') url += '/';
        return url;
    },

    _dirUrl: function(settings) {
        return this._baseUrl(settings) + '.papyrus/';
    },

    _fileUrl: function(settings, syncKey) {
        return this._baseUrl(settings) + '.papyrus/' + encodeURIComponent(syncKey) + '.json';
    },

    // MKCOL the .papyrus directory. Only called when PUT returns 409 (first-ever sync).
    // 201 = created, 405 = already exists — both OK.
    _ensureDirectory: function(settings, callback) {
        var url = this._dirUrl(settings);
        console.log("Sync: MKCOL " + url);
        var xhr = new XMLHttpRequest();
        xhr.open('MKCOL', url, true);
        xhr.setRequestHeader('Authorization', this._basicAuth(settings.syncUser, settings.syncPass));
        try { xhr.setRequestHeader('Origin', 'null'); } catch(e) {}
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            var ok = xhr.status === 201 || xhr.status === 405 || xhr.status === 200;
            console.log("Sync: MKCOL status=" + xhr.status + " ok=" + ok);
            callback(ok);
        };
        xhr.send();
    },

    // PUT the position file. Calls callback(status) when done.
    _doPut: function(settings, fileUrl, payload, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('PUT', fileUrl, true);
        xhr.setRequestHeader('Authorization', this._basicAuth(settings.syncUser, settings.syncPass));
        xhr.setRequestHeader('Content-Type', 'application/json');
        // webOS native apps run from file://, so the browser sends Origin: file:// on
        // non-simple cross-origin requests (PUT, DELETE). Some WebDAV servers (including
        // ownCloud) crash with 500 trying to parse file:// as an HTTP origin.
        // "null" is the CORS opaque-origin sentinel — valid per spec, and servers that
        // don't explicitly allow it simply ignore the header rather than crashing.
        // In old WebKit (webOS 534) Origin is not yet a forbidden header, so this
        // setRequestHeader call overrides what the browser would send. In modern browsers
        // it is a forbidden header and this call is silently ignored — harmless.
        try { xhr.setRequestHeader('Origin', 'null'); } catch(e) {}
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            console.log("Sync: PUT status=" + xhr.status);
            if (callback) callback(xhr.status);
        };
        xhr.send(payload);
    },

    // Push current position (and optional bookmarks array) to WebDAV.
    // Calls onDone(true) on success, onDone(false, status) on failure.
    // onDone is optional — omit for fire-and-forget behaviour.
    // identifier: the ePub's dc:identifier value (preferred sync key); pass null to use title+author.
    pushPosition: function(title, author, identifier, position, bookmarks, onDone) {
        var settings = this.getSettings();
        if (!settings.syncEnabled || !settings.syncUrl) {
            console.log("Sync: push skipped (disabled or no URL)");
            if (onDone) onDone(false, 0);
            return;
        }

        var self = this;
        var syncKey = this.makeSyncKey(title, author, identifier);
        var fileUrl = this._fileUrl(settings, syncKey);
        var payload = JSON.stringify({
            title: title,
            author: author,
            position: position,
            timestamp: Date.now(),
            bookmarks: bookmarks || []
        });

        console.log("Sync: push starting for key=" + syncKey + " position=" + position);

        // Inner handler so the 423-retry path can recurse exactly once.
        var handlePutStatus = function(status, isRetry) {
            if (status === 409) {
                // Parent collection doesn't exist yet — create it and retry once
                console.log("Sync: directory missing, attempting MKCOL");
                self._ensureDirectory(settings, function(ok) {
                    if (!ok) {
                        console.log("Sync: push aborted, could not create directory");
                        if (onDone) onDone(false, 409);
                        return;
                    }
                    self._doPut(settings, fileUrl, payload, function(retryStatus) {
                        var ok2 = retryStatus >= 200 && retryStatus < 300;
                        console.log("Sync: push retry status=" + retryStatus + " ok=" + ok2);
                        if (onDone) onDone(ok2, retryStatus);
                    });
                });
            } else if (status === 423 && !isRetry) {
                // WebDAV 423 Locked — ownCloud desktop client may hold a stale lock.
                // Wait 3 s and retry once; a transient lock should clear in that window.
                // If the lock persists the caller receives (false, 423) and can advise the user.
                console.log("Sync: push got 423 Locked, retrying in 3s");
                setTimeout(function() {
                    self._doPut(settings, fileUrl, payload, function(retryStatus) {
                        console.log("Sync: push 423-retry status=" + retryStatus);
                        handlePutStatus(retryStatus, true);
                    });
                }, 3000);
            } else if (status === 0 && !isRetry) {
                // Cold TLS handshake or transient CORS preflight failure — retry once after 2s.
                // pull already does this; push needs it too for never-synced books on first tap.
                console.log("Sync: push got status 0, retrying in 2s");
                setTimeout(function() {
                    self._doPut(settings, fileUrl, payload, function(retryStatus) {
                        console.log("Sync: push status-0-retry status=" + retryStatus);
                        handlePutStatus(retryStatus, true);
                    });
                }, 2000);
            } else if (status === 0) {
                console.log("Sync: push failed (network/CORS error)");
                if (onDone) onDone(false, 0);
            } else if (status < 200 || status >= 300) {
                console.log("Sync: push failed with status=" + status);
                if (onDone) onDone(false, status);
            } else {
                console.log("Sync: push succeeded status=" + status);
                if (onDone) onDone(true, status);
            }
        };

        this._doPut(settings, fileUrl, payload, function(status) {
            handlePutStatus(status, false);
        });
    },

    // Pull position from WebDAV. Calls callback(data) or callback(null) if unavailable.
    // Retries once on status 0 (cold TLS handshake on webOS can time out on first attempt).
    // Only pull retries — push is fire-and-forget, so there is no concurrent retry collision.
    // identifier: the ePub's dc:identifier (preferred key). On 404, automatically retries
    // with the legacy title+author key for backward compatibility with pre-identifier sync files.
    pullPosition: function(title, author, identifier, callback) {
        var settings = this.getSettings();
        if (!settings.syncEnabled || !settings.syncUrl) {
            console.log("Sync: pull skipped (disabled or no URL)");
            callback(null);
            return;
        }

        var self     = this;
        var syncKey  = this.makeSyncKey(title, author, identifier);
        var legacyKey = (identifier) ? this.makeLegacySyncKey(title, author) : null;
        var auth     = this._basicAuth(settings.syncUser, settings.syncPass);

        console.log("Sync: pull starting for key=" + syncKey + (legacyKey ? " (legacy fallback=" + legacyKey + ")" : ""));

        var doGet = function(key, retry, onDone) {
            var url = self._fileUrl(settings, key);
            console.log("Sync: GET " + url + (retry ? "" : " (retry)"));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.setRequestHeader('Authorization', auth);
            xhr.onreadystatechange = function() {
                if (xhr.readyState !== 4) return;
                console.log("Sync: GET status=" + xhr.status);
                if (xhr.status === 0 && retry) {
                    console.log("Sync: GET status=0, retrying in 2s");
                    setTimeout(function() { doGet(key, false, onDone); }, 2000);
                    return;
                }
                onDone(xhr.status, xhr.responseText);
            };
            xhr.send();
        };

        var handleResult = function(status, text) {
            if (status === 200 && text) {
                try {
                    var data = JSON.parse(text);
                    console.log("Sync: pull got position=" + data.position + " bookmarks=" + (data.bookmarks ? data.bookmarks.length : 0));
                    callback(data);
                } catch(e) {
                    console.log("Sync: pull JSON parse error: " + e);
                    callback(null);
                }
            } else if (status === 404 && legacyKey && legacyKey !== syncKey) {
                // Primary key not found — try the old title+author key once (no retry on legacy).
                // Capture the key BEFORE zeroing legacyKey (the guard that prevents re-entry).
                var keyToRetry = legacyKey;
                legacyKey = null; // prevent infinite loop
                console.log("Sync: primary key 404, trying legacy key=" + keyToRetry);
                doGet(keyToRetry, false, handleResult);
            } else {
                // Pass the HTTP status to the caller so it can show a precise message:
                // status=0 → network/CORS failure; status=404 → no sync file yet (not an error).
                console.log("Sync: pull returning null (status=" + status + ")");
                callback(null, status);
            }
        };

        doGet(syncKey, true, handleResult);
    },

    // Test connection with a GET — avoids CORS preflight that PROPFIND triggers over HTTPS.
    // Retries once on status 0 (cold TLS handshake on webOS can time out on first attempt).
    testConnection: function(url, user, pass, callback) {
        var base = url || "";
        if (base && base.charAt(base.length - 1) !== '/') base += '/';
        if (!base) {
            callback(false, "No URL configured");
            return;
        }
        var auth = this._basicAuth(user, pass);
        console.log("Sync: testConnection GET " + base);
        var attempt = function(retry) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', base, true);
            xhr.setRequestHeader('Authorization', auth);
            xhr.onreadystatechange = function() {
                if (xhr.readyState !== 4) return;
                console.log("Sync: testConnection status=" + xhr.status + (retry ? "" : " (retry)"));
                if (xhr.status === 0 && retry) {
                    console.log("Sync: testConnection status=0, retrying in 1500ms");
                    setTimeout(function() { attempt(false); }, 1500);
                    return;
                }
                if (xhr.status >= 200 && xhr.status < 400) {
                    callback(true, null);
                } else if (xhr.status === 401) {
                    callback(false, "Authentication failed");
                } else if (xhr.status === 403) {
                    callback(false, "Access denied");
                } else if (xhr.status === 0) {
                    callback(false, "Cannot reach server (SSL cert or network error)");
                } else {
                    callback(false, "HTTP " + xhr.status);
                }
            };
            xhr.send();
        };
        attempt(true);
    }
};
