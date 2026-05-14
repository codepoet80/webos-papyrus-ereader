/**
 * PapyrusSyncManager - Reading position sync via WebDAV
 *
 * Stores per-book position files at {webdavUrl}/papyrus/{syncKey}.json
 * Uses XHR with Basic auth and Origin override (same technique as webdavclient's davapi.js).
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
            // Standard btoa; handles ASCII credentials fine
            return 'Basic ' + btoa((user || '') + ':' + (pass || ''));
        } catch(e) {
            // Fallback for non-ASCII characters
            return 'Basic ' + btoa(unescape(encodeURIComponent((user || '') + ':' + (pass || ''))));
        }
    },

    _baseUrl: function(settings) {
        var url = settings.syncUrl || "";
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
        var xhr = new XMLHttpRequest();
        xhr.open('MKCOL', this._dirUrl(settings), true);
        xhr.setRequestHeader('Authorization', this._basicAuth(settings.syncUser, settings.syncPass));
        xhr.setRequestHeader('Origin', 'http://localhost');
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            callback(xhr.status === 201 || xhr.status === 405 || xhr.status === 200);
        };
        xhr.send();
    },

    // Push current position (and optional bookmarks array) to WebDAV. Fire-and-forget.
    pushPosition: function(title, author, position, bookmarks) {
        var settings = this.getSettings();
        if (!settings.syncEnabled || !settings.syncUrl) return;

        var self = this;
        var syncKey = this.makeSyncKey(title, author);
        var payload = JSON.stringify({
            title: title,
            author: author,
            position: position,
            timestamp: Date.now(),
            bookmarks: bookmarks || []
        });

        this._ensureDirectory(settings, function(ok) {
            if (!ok) return;
            var xhr = new XMLHttpRequest();
            xhr.open('PUT', self._fileUrl(settings, syncKey), true);
            xhr.setRequestHeader('Authorization', self._basicAuth(settings.syncUser, settings.syncPass));
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Origin', 'http://localhost');
            xhr.send(payload);
        });
    },

    // Pull position from WebDAV. Calls callback(data) or callback(null) if unavailable.
    pullPosition: function(title, author, callback) {
        var settings = this.getSettings();
        if (!settings.syncEnabled || !settings.syncUrl) {
            callback(null);
            return;
        }

        var syncKey = this.makeSyncKey(title, author);
        var xhr = new XMLHttpRequest();
        xhr.open('GET', this._fileUrl(settings, syncKey), true);
        xhr.setRequestHeader('Authorization', this._basicAuth(settings.syncUser, settings.syncPass));
        xhr.setRequestHeader('Origin', 'http://localhost');
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 200 && xhr.responseText) {
                try {
                    callback(JSON.parse(xhr.responseText));
                } catch(e) {
                    callback(null);
                }
            } else {
                callback(null);
            }
        };
        xhr.send();
    },

    // Test connection using a PROPFIND on the base path. Returns true/false + error string.
    testConnection: function(url, user, pass, callback) {
        var base = url || "";
        if (base && base.charAt(base.length - 1) !== '/') base += '/';
        if (!base) {
            callback(false, "No URL configured");
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open('PROPFIND', base, true);
        xhr.setRequestHeader('Authorization', this._basicAuth(user, pass));
        xhr.setRequestHeader('Origin', 'http://localhost');
        xhr.setRequestHeader('Depth', '0');
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 400) {
                callback(true, null);
            } else if (xhr.status === 401) {
                callback(false, "Authentication failed");
            } else if (xhr.status === 0) {
                callback(false, "Network error (check URL and HTTPS)");
            } else {
                callback(false, "HTTP " + xhr.status);
            }
        };
        xhr.send();
    }
};
