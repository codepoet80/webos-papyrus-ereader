/**
 * PapyrusSyncManager - Reading position sync via WebDAV
 *
 * Stores per-book position files at {webdavUrl}/.papyrus/{syncKey}.json
 * Uses XHR with Basic auth for WebDAV sync.
 * Push happens on book close; pull happens on book open.
 */
var PapyrusSyncManager = {

    // Derive a stable, filesystem-safe key from title + author.
    // The same book on any device produces the same key.
    makeSyncKey: function(title, author) {
        var raw = ((title || 'unknown') + '_' + (author || 'unknown'))
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/, '')
            .substring(0, 80);
        return raw || 'unknown_book';
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

    // MKCOL the papyrus directory. 201 = created, 405 = already exists — both OK.
    // Always called on every push so URL changes in settings take effect immediately.
    _ensureDirectory: function(settings, callback) {
        var url = this._dirUrl(settings);
        console.log("Sync: MKCOL " + url);
        var xhr = new XMLHttpRequest();
        xhr.open('MKCOL', url, true);
        xhr.setRequestHeader('Authorization', this._basicAuth(settings.syncUser, settings.syncPass));
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            var ok = xhr.status === 201 || xhr.status === 405 || xhr.status === 200;
            console.log("Sync: MKCOL status=" + xhr.status + " ok=" + ok);
            callback(ok);
        };
        xhr.send();
    },

    // Push current position (and optional bookmarks array) to WebDAV. Fire-and-forget.
    pushPosition: function(title, author, position, bookmarks) {
        var settings = this.getSettings();
        if (!settings.syncEnabled || !settings.syncUrl) {
            console.log("Sync: push skipped (disabled or no URL)");
            return;
        }

        var self = this;
        var syncKey = this.makeSyncKey(title, author);
        var fileUrl = this._fileUrl(settings, syncKey);
        var payload = JSON.stringify({
            title: title,
            author: author,
            position: position,
            timestamp: Date.now(),
            bookmarks: bookmarks || []
        });

        console.log("Sync: push starting for key=" + syncKey + " position=" + position);

        this._ensureDirectory(settings, function(ok) {
            if (!ok) {
                console.log("Sync: push aborted, directory unavailable");
                return;
            }
            console.log("Sync: PUT " + fileUrl);
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', fileUrl, true);
            xhr.setRequestHeader('Authorization', self._basicAuth(settings.syncUser, settings.syncPass));
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.onreadystatechange = function() {
                if (xhr.readyState !== 4) return;
                console.log("Sync: PUT status=" + xhr.status);
            };
            xhr.send(payload);
        });
    },

    // Pull position from WebDAV. Calls callback(data) or callback(null) if unavailable.
    // Retries once on status 0 (cold TLS handshake on webOS can time out on first attempt).
    // Only pull retries — push is fire-and-forget, so there is no concurrent retry collision.
    pullPosition: function(title, author, callback) {
        var settings = this.getSettings();
        if (!settings.syncEnabled || !settings.syncUrl) {
            console.log("Sync: pull skipped (disabled or no URL)");
            callback(null);
            return;
        }

        var syncKey = this.makeSyncKey(title, author);
        var url  = this._fileUrl(settings, syncKey);
        var auth = this._basicAuth(settings.syncUser, settings.syncPass);

        console.log("Sync: pull starting for key=" + syncKey);

        var attempt = function(retry) {
            console.log("Sync: GET " + url + (retry ? "" : " (retry)"));
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.setRequestHeader('Authorization', auth);
            xhr.onreadystatechange = function() {
                if (xhr.readyState !== 4) return;
                console.log("Sync: GET status=" + xhr.status);
                if (xhr.status === 0 && retry) {
                    console.log("Sync: GET status=0, retrying in 2s");
                    setTimeout(function() { attempt(false); }, 2000);
                    return;
                }
                if (xhr.status === 200 && xhr.responseText) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        console.log("Sync: pull got position=" + data.position + " bookmarks=" + (data.bookmarks ? data.bookmarks.length : 0));
                        callback(data);
                    } catch(e) {
                        console.log("Sync: pull JSON parse error: " + e);
                        callback(null);
                    }
                } else {
                    console.log("Sync: pull returning null (status=" + xhr.status + ")");
                    callback(null);
                }
            };
            xhr.send();
        };
        attempt(true);
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
