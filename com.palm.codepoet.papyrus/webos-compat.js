/**
 * webos-compat.js
 *
 * Reverse polyfill: maps legacy webOS / Enyo 1 APIs to modern browser equivalents.
 *
 * Load this after enyo.js and before your app's depends.js. On a real webOS device
 * (window.PalmSystem present) it exits immediately and touches nothing. In a modern
 * browser it installs stubs and shims so the rest of the app code runs unchanged.
 *
 * Designed to be portable — drop this file into any Enyo 1 project and add:
 *   <script src="webos-compat.js"></script>
 * after enyo.js in index.html.
 *
 * Coverage:
 *   enyo.windows.setWindowProperties  → Screen Wake Lock API
 *   enyo.windows.addBannerMessage     → DOM toast notification
 *   PalmService kind                  → silent stub component
 *   FilePicker kind                   → <input type="file"> wrapper
 *   ApplicationEvents kind            → window focus/blur/resize listeners
 *   PalmServiceBridge                 → stub class
 *   enyo.fetchAppInfo()               → sync-XHR read of appinfo.json
 *   enyo.fetchDeviceInfo()            → browser stub
 *   $L()                              → passthrough if not already defined
 */

(function () {
    // NOTE: no 'use strict' here — Enyo 1's inherited() relies on arguments.callee,
    // which strict mode forbids. Kind methods defined in a strict IIFE inherit
    // strict mode, breaking this.inherited(arguments) in all our shim kinds.

    // On a real webOS device the native APIs are already present — nothing to do.
    if (window.PalmSystem) {
        return;
    }

    enyo.log('webos-compat: browser environment detected, installing shims');


    // =========================================================================
    // enyo.windows — screen management and notifications
    // =========================================================================

    enyo.windows = enyo.windows || {};

    // --- Screen Wake Lock (replaces blockScreenTimeout) ----------------------

    var _wakeLock = null;

    enyo.windows.setWindowProperties = function (win, props) {
        if (!props || typeof props.blockScreenTimeout === 'undefined') return;

        if (props.blockScreenTimeout) {
            if (navigator.wakeLock && !_wakeLock) {
                navigator.wakeLock.request('screen')
                    .then(function (lock) {
                        _wakeLock = lock;
                        // Re-acquire if the page visibility API releases it automatically
                        _wakeLock.addEventListener('release', function () {
                            _wakeLock = null;
                        });
                        enyo.log('webos-compat: screen wake lock acquired');
                    })
                    .catch(function (e) {
                        enyo.warn('webos-compat: wake lock request failed: ' + e);
                    });
            }
        } else {
            if (_wakeLock) {
                _wakeLock.release()
                    .then(function () {
                        enyo.log('webos-compat: screen wake lock released');
                        _wakeLock = null;
                    })
                    .catch(function () { _wakeLock = null; });
            }
        }
    };

    // --- Toast notification (replaces addBannerMessage) ----------------------

    enyo.windows.addBannerMessage = function (message, launchParams, icon) {
        _showToast(message, icon);
    };

    function _showToast(message, icon) {
        var toast = document.createElement('div');
        toast.style.cssText = [
            'position:fixed',
            'top:24px',
            'left:50%',
            'transform:translateX(-50%)',
            'background:rgba(0,0,0,0.82)',
            'color:#fff',
            'padding:10px 18px',
            'border-radius:6px',
            'font:14px/1.4 sans-serif',
            'z-index:99999',
            'pointer-events:none',
            'white-space:nowrap',
            'box-shadow:0 2px 8px rgba(0,0,0,0.4)',
            'opacity:1',
            'transition:opacity 0.4s ease'
        ].join(';');

        if (icon) {
            var img = document.createElement('img');
            img.src = icon;
            img.style.cssText = 'width:16px;height:16px;vertical-align:middle;margin-right:8px';
            toast.appendChild(img);
        }
        toast.appendChild(document.createTextNode(message));
        document.body.appendChild(toast);

        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 400);
        }, 3000);
    }

    // =========================================================================
    // PalmService kind — silent stub
    //
    // Usage in Enyo component definitions:
    //   {name: "myService", kind: "PalmService",
    //    service: "palm://...", method: "someMethod", onResponse: "handler"}
    //
    // The stub no-ops call() and never fires onResponse/onFailure, which is
    // the safe default for browser use. Override specific services in your app
    // layer (e.g. replace DimService with navigator.wakeLock calls) rather than
    // teaching this generic stub about individual services.
    // =========================================================================

    enyo.kind({
        name: 'PalmService',
        kind: enyo.Component,
        published: {
            service: '',
            method: ''
        },
        // Primary call method — params is the request payload object, opts is optional
        call: function (params, opts) {
            enyo.log('webos-compat: PalmService stub — ignoring call to ' +
                (this.service || '') + (this.method || ''));
        },
        response: function () {},
        cancel: function () {}
    });

    // =========================================================================
    // FilePicker kind — wraps <input type="file">
    //
    // IMPORTANT: On webOS, onPickFile receives an array of file-path strings.
    // This stub fires onPickFile with an array of browser File objects instead.
    // FileImporter.js must be updated to handle File objects (read via FileReader
    // API) in addition to path strings. Gate the two paths on whether the first
    // item is a string or a File object.
    // =========================================================================

    // Use name 'enyo.FilePicker' so enyo.constructorForKind("FilePicker") finds
    // this via enyo["FilePicker"] and overrides the bundled webOS FilePicker kind
    // (which tries to load a CrossAppUI panel that doesn't exist in a browser).
    enyo.kind({
        name: 'enyo.FilePicker',
        kind: enyo.Component,
        published: {
            fileType: [],
            allowMultiSelect: false
        },
        events: {
            onPickFile: ''
        },
        create: function () {
            this.inherited(arguments);
            var self = this;
            this._input = document.createElement('input');
            this._input.type = 'file';
            this._input.style.display = 'none';
            this._input.addEventListener('change', function () {
                var files = Array.prototype.slice.call(self._input.files);
                if (files.length) self.doPickFile(files);
                self._input.value = ''; // allow re-selecting the same file
            });
            document.body.appendChild(this._input);
        },
        destroy: function () {
            if (this._input && this._input.parentNode) {
                this._input.parentNode.removeChild(this._input);
            }
            this.inherited(arguments);
        },
        // pickFile() is the webOS API name; open() is our alias.
        // Main.js calls pickFile() so both must exist.
        pickFile: function (opts) {
            this.open(opts);
        },
        open: function (opts) {
            opts = opts || {};
            this._input.multiple = !!(opts.allowMultiSelect || this.allowMultiSelect);
            var types = opts.fileType || this.fileType || [];
            this._input.accept = (types.indexOf('document') >= 0) ? '.epub,.pdf' : '.epub';
            this._input.click();
        }
    });

    // =========================================================================
    // ApplicationEvents kind — maps webOS window lifecycle to browser events
    // =========================================================================

    enyo.kind({
        name: 'ApplicationEvents',
        kind: enyo.Component,
        events: {
            onWindowActivated: '',
            onWindowDeactivated: '',
            onWindowRotated: ''
        },
        create: function () {
            this.inherited(arguments);
            var self = this;
            this._onFocus   = function () { self.doWindowActivated(); };
            this._onBlur    = function () { self.doWindowDeactivated(); };
            this._onRotate  = function () { self.doWindowRotated(); };
            window.addEventListener('focus',             this._onFocus);
            window.addEventListener('blur',              this._onBlur);
            window.addEventListener('orientationchange', this._onRotate);
            window.addEventListener('resize',            this._onRotate);
        },
        destroy: function () {
            window.removeEventListener('focus',             this._onFocus);
            window.removeEventListener('blur',              this._onBlur);
            window.removeEventListener('orientationchange', this._onRotate);
            window.removeEventListener('resize',            this._onRotate);
            this.inherited(arguments);
        }
    });

    // =========================================================================
    // PalmServiceBridge — stub class used by FileImporter and SyncManager
    //
    // Calls onservicecallback asynchronously with a failure payload so callers
    // that check returnValue can fall through to their browser code paths.
    // =========================================================================

    window.PalmServiceBridge = function () {
        this.onservicecallback = null;
    };

    PalmServiceBridge.prototype.call = function (url, params) {
        enyo.log('webos-compat: PalmServiceBridge stub — ignoring call to ' + url);
        var cb = this.onservicecallback;
        if (cb) {
            setTimeout(function () {
                cb(JSON.stringify({
                    returnValue: false,
                    errorCode: -1,
                    errorText: 'Not available in browser'
                }));
            }, 0);
        }
    };

    PalmServiceBridge.prototype.cancel = function () {};

    // =========================================================================
    // enyo.fetchAppInfo — read appinfo.json synchronously
    //
    // Callers (Updater-Helper.js, About dialog) expect a synchronous return
    // value. We use a synchronous XHR once and cache the result. Sync XHR is
    // deprecated in browsers but still works and is the least-disruptive shim
    // here. Replace with a cached async fetch if a browser starts enforcing it.
    // =========================================================================

    var _appInfo = null;
    var _origFetchAppInfo = enyo.fetchAppInfo;

    enyo.fetchAppInfo = function () {
        // Let Enyo's own implementation handle it if it worked (e.g. future Enyo versions)
        var native = _origFetchAppInfo ? _origFetchAppInfo.call(enyo) : null;
        if (native && native.id) return native;
        if (_appInfo) return _appInfo;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'appinfo.json', false); // synchronous — intentional
            xhr.send();
            _appInfo = JSON.parse(xhr.responseText);
        } catch (e) {
            enyo.warn('webos-compat: could not load appinfo.json, using defaults');
            _appInfo = { id: 'unknown', version: '0.0.0', title: 'App' };
        }
        return _appInfo;
    };

    // =========================================================================
    // enyo.fetchDeviceInfo — return a browser stub
    //
    // Callers (Updater-Helper.js) use this to identify the device to the update
    // service. We pass the user-agent string so the service can log browser hits.
    // =========================================================================

    enyo.fetchDeviceInfo = function () {
        return {
            modelName:       'Browser',
            platformVersion: navigator.userAgent,
            carrierName:     'WiFi',
            serialNumber:    null   // null triggers UUID fallback in Updater-Helper
        };
    };

    // =========================================================================
    // $L — localization passthrough
    //
    // Enyo 1 defines this, but just in case it hasn't been set up yet when this
    // file runs (load-order edge case), provide a safe no-op passthrough.
    // =========================================================================

    if (typeof window.$L === 'undefined') {
        window.$L = function (s) { return s; };
    }

    // =========================================================================
    // WebSQL → IndexedDB shim
    //
    // Chrome 130+ removed openDatabase; Firefox never had it. This shim
    // implements just enough of the WebSQL surface that Database.js uses:
    //   openDatabase(name)  →  _WebSQLDB
    //   db.transaction / db.readTransaction
    //   tx.executeSql(sql, args, successCb, errorCb)
    //
    // SQL patterns covered (all others warn + succeed silently):
    //   PRAGMA, VACUUM          → no-op
    //   CREATE TABLE IF NOT … → no-op (store is pre-created on IDB open)
    //   DROP TABLE …            → no-op
    //   DELETE FROM TABLE …     → store.clear()   (flushTable typo)
    //   INSERT OR REPLACE …     → store.put()
    //   DELETE FROM data WHERE name == key → store.delete()
    //   SELECT … FROM data WHERE col = ?  → store.get()
    //   SELECT … FROM data               → store.getAll()
    //   SELECT … FROM sqlite_master …    → answered from objectStoreNames
    // =========================================================================

    if (typeof window.openDatabase === 'undefined') {

        function _makeResultSet(rows) {
            return {
                rows: {
                    length: rows.length,
                    item: function (i) { return rows[i]; }
                },
                insertId:     null,
                rowsAffected: rows.length
            };
        }

        function _WebSQLDB(name) {
            this._idb     = null;
            this._pending = [];
            var self = this;
            var req = indexedDB.open('websql_' + name, 1);
            req.onupgradeneeded = function (e) {
                var idb = e.target.result;
                if (!idb.objectStoreNames.contains('data')) {
                    idb.createObjectStore('data', { keyPath: 'name' });
                }
            };
            req.onsuccess = function (e) {
                self._idb = e.target.result;
                var q = self._pending.splice(0);
                for (var i = 0; i < q.length; i++) { self._runTxn(q[i]); }
            };
            req.onerror = function (e) {
                enyo.warn('webos-compat: IndexedDB open failed for "' + name + '": ' + e.target.error);
            };
        }

        _WebSQLDB.prototype.transaction = function (cb, errCb, successCb) {
            var txn = { cb: cb, errCb: errCb, successCb: successCb };
            if (this._idb) { this._runTxn(txn); } else { this._pending.push(txn); }
        };

        _WebSQLDB.prototype.readTransaction = _WebSQLDB.prototype.transaction;

        _WebSQLDB.prototype._runTxn = function (txn) {
            var self = this;
            var stmts = [];
            var tx = {
                executeSql: function (sql, args, sCb, eCb) {
                    stmts.push({ sql: sql, args: args || [], sCb: sCb, eCb: eCb });
                }
            };
            try { txn.cb(tx); } catch (e) {
                enyo.warn('webos-compat: WebSQL txn cb threw: ' + e);
                if (txn.errCb) { txn.errCb({ message: String(e), code: 0 }); }
                return;
            }
            self._runStmts(stmts, 0, txn);
        };

        _WebSQLDB.prototype._runStmts = function (stmts, idx, txn) {
            var self = this;
            if (idx >= stmts.length) {
                if (txn.successCb) { txn.successCb(); }
                return;
            }
            var s = stmts[idx];
            self._execSql(s.sql, s.args, function (rs) {
                if (s.sCb) { s.sCb(null, rs); }
                self._runStmts(stmts, idx + 1, txn);
            }, function (err) {
                if (s.eCb) { s.eCb(null, err); }
                if (txn.errCb) { txn.errCb(err); }
                // remaining statements aborted
            });
        };

        _WebSQLDB.prototype._execSql = function (sql, args, ok, fail) {
            var db = this._idb;
            var s  = sql.trim();
            var m, t, r;

            // No-ops: PRAGMA, VACUUM, CREATE TABLE, DROP TABLE
            if (/^(PRAGMA|VACUUM|CREATE\s+TABLE|DROP\s+TABLE)/i.test(s)) {
                ok(_makeResultSet([]));
                return;
            }

            // DELETE FROM TABLE name  (flushTable — typo in original code)
            m = s.match(/^DELETE\s+FROM\s+TABLE\s+(\w+)/i);
            if (m) {
                var store = m[1];
                if (!db.objectStoreNames.contains(store)) { ok(_makeResultSet([])); return; }
                t = db.transaction([store], 'readwrite');
                r = t.objectStore(store).clear();
                r.onsuccess = function () { ok(_makeResultSet([])); };
                r.onerror   = function (e) { fail({ message: String(e.target.error), code: 0 }); };
                return;
            }

            // INSERT OR REPLACE INTO data (name,value) values ('key', ?)
            m = s.match(/^INSERT\s+OR\s+REPLACE\s+INTO\s+data\s*\([^)]+\)\s+values\s*\(\s*'([^']*)'\s*,\s*\?\s*\)/i);
            if (m) {
                t = db.transaction(['data'], 'readwrite');
                r = t.objectStore('data').put({ name: m[1], value: args[0] });
                r.onsuccess = function () { ok(_makeResultSet([])); };
                r.onerror   = function (e) { fail({ message: String(e.target.error), code: 0 }); };
                return;
            }

            // DELETE FROM data WHERE name == key  (non-parameterized, remove())
            m = s.match(/^DELETE\s+FROM\s+data\s+WHERE\s+name\s*=+\s*(.+?)(?:;|\s*$)/i);
            if (m) {
                var key = m[1].trim().replace(/^['"]|['"]$/g, '');
                t = db.transaction(['data'], 'readwrite');
                r = t.objectStore('data').delete(key);
                r.onsuccess = function () { ok(_makeResultSet([])); };
                r.onerror   = function (e) { fail({ message: String(e.target.error), code: 0 }); };
                return;
            }

            // sqlite_master queries (tableExists / purgeDB)
            if (/FROM\s+sqlite_master/i.test(s)) {
                var rows = [];
                if (args && args.length > 0) {
                    if (db.objectStoreNames.contains(args[0])) { rows = [{ name: args[0] }]; }
                } else {
                    for (var i = 0; i < db.objectStoreNames.length; i++) {
                        rows.push({ name: db.objectStoreNames[i] });
                    }
                }
                ok(_makeResultSet(rows));
                return;
            }

            // SELECT col FROM store WHERE col = ?
            m = s.match(/^SELECT\s+\S+\s+FROM\s+(\w+)\s+WHERE\s+\w+\s*=\s*\?/i);
            if (m) {
                var store = m[1];
                t = db.transaction([store], 'readonly');
                r = t.objectStore(store).get(args[0]);
                r.onsuccess = function (e) {
                    var rec = e.target.result;
                    ok(_makeResultSet(rec ? [rec] : []));
                };
                r.onerror = function (e) { fail({ message: String(e.target.error), code: 0 }); };
                return;
            }

            // SELECT col FROM store  (no WHERE)
            m = s.match(/^SELECT\s+\S+\s+FROM\s+(\w+)/i);
            if (m) {
                var store = m[1];
                t = db.transaction([store], 'readonly');
                r = t.objectStore(store).getAll();
                r.onsuccess = function (e) { ok(_makeResultSet(e.target.result || [])); };
                r.onerror   = function (e) { fail({ message: String(e.target.error), code: 0 }); };
                return;
            }

            enyo.warn('webos-compat: unhandled SQL: ' + s);
            ok(_makeResultSet([]));
        };

        window.openDatabase = function (name) {
            return new _WebSQLDB(name);
        };

        enyo.log('webos-compat: WebSQL→IndexedDB shim installed');
    }

    // =========================================================================
    // App Menu trigger
    //
    // On webOS the Menu button / gesture-area swipe opens the AppMenu.
    // In a browser we inject a ☰ button in the top-left corner and map the
    // Escape key to enyo.appMenu.toggle() so the menu is always reachable.
    // =========================================================================

    window.addEventListener('load', function () {
        // Re-position the AppMenu below the hamburger button.
        // The Enyo CSS hard-codes top:0 left:-10px for the webOS chrome position;
        // applyBounds() passes an empty object so those CSS defaults win.
        var style = document.createElement('style');
        style.textContent = [
            '.enyo-popup.enyo-appmenu { top: 44px !important; left: 8px !important; }',
            '.enyo-appmenu-inner { margin: 0 !important; }'
        ].join(' ');
        document.head.appendChild(style);

        var btn = document.createElement('div');
        btn.innerHTML = '&#9776;';
        btn.title = 'Menu (Esc)';
        btn.style.cssText = [
            'position:fixed',
            'top:10px',
            'left:10px',
            'z-index:120',          /* above book content (z-index ~1), below Enyo popups */
            'background:rgba(0,0,0,0.45)',
            'color:#fff',
            'border-radius:4px',
            'padding:4px 10px',
            'font-size:20px',
            'line-height:1.2',
            'cursor:pointer',
            'user-select:none',
            'opacity:0.55',
            'transition:opacity 0.15s',
            'box-sizing:border-box',
            'margin:0'
        ].join(';');
        btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
        btn.addEventListener('mouseleave', function () { btn.style.opacity = '0.55'; });
        btn.addEventListener('click', function () {
            if (typeof enyo !== 'undefined' && enyo.appMenu) { enyo.appMenu.toggle(); }
        });
        document.body.appendChild(btn);

        window.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var tag = (e.target || {}).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (typeof enyo !== 'undefined' && enyo.appMenu) { enyo.appMenu.toggle(); }
        });
    });

    enyo.log('webos-compat: shims installed');

}());
