# Import Rework Plan

> ## STATUS: P0–P3 complete — shipped as 1.6.0 (build v204), verified on device and in the PWA. Uncommitted.
>
> **The root cause turned out to be F16, found during P3:** `concatArray` in
> `src/io/Bytes.js` — the engine's most-used primitive — appended *backwards*,
> writing past the end of the destination array first. That permanently
> degraded every growing byte buffer into a sparse/dictionary array. Measured:
> accumulating 1.3MB in 4KB pieces took **58.5 s** backwards vs **31 ms**
> forwards (~1900×). The penalty scales with bytes *already* accumulated, so
> short books were fine and long ones appeared to hang — precisely the
> content-dependent "nondeterminism". Fixed by appending forwards.
>
> Done: F1 F2 F3 F4 F5 F6 F8 F13 F16, plus the trampoline (P3.1), batched
> writes (P3.2), pre-flight (P2.3) and the spinner rework.
> Deferred: F7 (largely subsumed by F16; residual is now linear — see P3.3),
> F10/F11/F14.
>
> **F9 resolved — chapter breaks are ON by default again.** Their apparent
> 10–20× import cost was F16 all along; with that fixed the harness shows
> identical work either way (Star Trek: 474 steps / 18 writes with breaks on
> *or* off). Two related changes:
> * Boundaries are now recorded at import **unconditionally**. Gating capture
>   on the preference was a design bug: boundaries live in the book's stored
>   metadata, so a book imported while the preference was off had none, and
>   turning the preference on later did nothing until re-import. It shipped
>   that way briefly and was caught in the PWA. The preference now controls
>   **display only** (`PageFitter.chapterBreaksEnabled`), so toggling it takes
>   effect on the next book open.
> * Books imported before build v204 still have no stored boundaries and need
>   one re-import. Anything imported from v204 on works immediately.
>
> Verified on device (webOS 1.6.0) and in the PWA.
>
> **Automated verification** (run all three after any change):
> ```
> NODE_PATH=<dir with jsdom> node tools/import-bench.js /Users/jonwise/Desktop/BooksToTest
> NODE_PATH=<dir with jsdom> node tools/import-cancel-test.js
> node tools/make-pathological-epubs.js /tmp/patho && \
>   NODE_PATH=<dir with jsdom> node tools/import-bench.js /tmp/patho
> ```
>
> **Verified:** TouchPad import speed confirmed good by the user; PWA import,
> chapter breaks, and the cancel/lock fix all confirmed working. Still worth
> recording once: a clean IMPORTSTATS line as the device baseline (below).

Companion to `IMPORT-AUDIT.html` (finding IDs F1–F16 refer to that document).
This is an implementation spec: each phase lists exact files, exact edit sites,
code templates, and acceptance tests. Work the phases **in order** — each one
de-risks the next. Do not combine phases into one build.

---

## 0. Ground rules — read before writing any code

**Target runtime is webOS 3.0.5 (WebKit 534 / JavaScriptCore, 2011).**
- ES5 only: `var` and `function`. NO arrow functions, `let`/`const`, template
  literals, Promises, `class`, default parameters, spread, `Object.assign`.
- `Array.prototype.map/filter/indexOf/forEach` are safe (native or polyfilled
  in `app/src/Polyfills.js` / `app/src/MojoCompat.js`).
- `Function.prototype.defer()` == `setTimeout(fn, 10)` (MojoCompat.js). Every
  defer costs ≥10ms of wall time on device.

**File conventions.**
- Most engine files (`app/src/**`, `app/app/**`) use **CRLF line endings and
  TAB indentation**. If a string-match edit fails, inspect actual bytes with
  `sed -n 'START,ENDp' file | sed -n l` and, if needed, do the edit with a
  small node script writing explicit `\r\n`.
- After every JS edit: `node --check <file>` must pass.
- Package with `./build.sh` (auto-bumps the build number in
  `app/serviceworker.js` and `app/app/Main.js`, then runs `palm-package app`).

**Device workflow (required for every on-device test).**
```
palm-install com.palm.codepoet.papyrus_*.ipk
# webOS caches app code; a Luna restart is REQUIRED or you may test stale bits:
printf 'initctl restart LunaSysMgr\nexit\n' | novacom open tty://
# (fallback if initctl unavailable: stop LunaSysMgr, then start LunaSysMgr)
palm-log -f com.palm.codepoet.papyrus     # follow logs
palm-log --system-log-level=error         # keep device at default log level
```
Verify the About dialog shows the new `(build vNNN)` before trusting any test.

**Canonical benchmark protocol** (used by every phase's acceptance tests):
1. Book: `Being Human - Star Trek_ New Frontier 12 - Peter David.epub`
   (3.6MB zip, 22 spine items, ~470KB text, one 1.1MB cover).
2. Fresh app launch (close the card first). Device log level = `error`.
3. Screen on, stay on the library card, do NOT open books during import.
4. Record the single `IMPORTSTATS` line (exists after P0).
5. Baseline expectation: total ≈ 90–110s on a TouchPad, matching 1.5.8.

**Canary books** (regression set — all must import and open after each phase):
- Mad Libs 10 (non-conformant `text/html` media-types + orphan spine ref)
- Goosebumps Welcome To Dead House (`opf:`-prefixed OPF elements)
- Star Trek Being Human (benchmark; also exercises cover pipeline)
- "Cognition in the Wild" if available (CLAUDE.md fix #19 canary: ≤5 min)

**Do-not-touch list** (out of scope for all phases):
- `HTMLParser.js` byte state machine internals (except the single valve in P3.3)
- `Inflate.js` decompression math (only the worker's guard wrapper in P1)
- `PageFitter.js` fitting/binary-search logic
- The progress phase strings `"Processing"`, `"Encoding image"`,
  `"Writing image"` — `Main.js` `keepAlive()` (line ~932) does substring
  matching on them to detect the content phase. If you change any progress
  string, update that matcher in the same commit.

**Parity rule:** `FileImporter.js` has two parallel pipelines that must stay
in sync — `importEpub` (webOS, path string) and `_processEpubArrayBuffer`
(PWA/browser, ArrayBuffer). Every P1/P2 change lands in BOTH, or is explicitly
scoped with a comment saying why not.

---

## P0 — Instrumentation (no behavior changes)

Goal: one `IMPORTSTATS` line per import so every future change is measurable.

### P0.1 Add the stats collector
File: `app/app/common/FileImporter.js` — add at top of file (below the
`ArrayBufferByteReader` block):

```js
// Import instrumentation (see IMPORT-AUDIT.html / IMPORT-REWORK-PLAN.md P0).
// One warn-level summary line per import so regressions are diagnosable from
// logs at the device's default (error/warn) log level.
var ImportStats = {
	active: false,
	t0: 0, tPhase: 0, phases: null, counts: null, file: "",
	begin: function(name) {
		this.active = true;
		this.t0 = this.tPhase = Date.now();
		this.phases = {}; this.counts = {};
		this.file = (name || "").split("/").pop();
	},
	phase: function(name) {
		if (!this.active) return;
		var now = Date.now();
		this.phases[name] = (this.phases[name] || 0) + (now - this.tPhase);
		this.tPhase = now;
	},
	count: function(key, n) {
		if (!this.active) return;
		this.counts[key] = (this.counts[key] || 0) + (n || 1);
	},
	end: function(status) {
		if (!this.active) return;
		this.active = false;
		var total = ((Date.now() - this.t0) / 1000).toFixed(1);
		var parts = ["IMPORTSTATS status=" + status, "file=" + this.file, "total=" + total + "s"];
		var k;
		for (k in this.phases) { parts.push(k + "=" + (this.phases[k] / 1000).toFixed(1) + "s"); }
		for (k in this.counts) { parts.push(k + "=" + this.counts[k]); }
		enyo.warn(parts.join(" "));
	}
};
```
Note: `enyo.warn` (not `enyo.log`) so the line is visible at default device
log level. `phase()` accumulates into the *named* bucket the time since the
previous phase call — call it AT THE END of each phase.

### P0.2 Hook it
All hooks are additive one-liners. In `importEpub` (webOS path):
- Right after the `.epub` extension check passes: `ImportStats.begin(filePath);`
- In the `File` callback after the failure check: `ImportStats.phase("load");`
- In the `EpubReader` callback after the null check: `ImportStats.phase("parse");`
  (this bucket = zip walk + inflate + filterMarkup, the whole EpubReader phase)
- In `continueWithCover`, first line: `ImportStats.phase("cover");`
- In the HTMLBook completion callback, after the `isReady` check passes:
  `ImportStats.phase("store");` then `ImportStats.end("ok");` just before
  `callback(bookData, null);`
- Every error `callback(null, ...)` site in `importEpub` gets
  `ImportStats.end("error");` on the line before it. There are six:
  no-path, not-epub, file-load-fail, zip-fail, reader-null, book-not-ready.

Mirror the same hooks in `_processEpubArrayBuffer` (begin at top with
`filename`, phases at the same milestones).

Counter hooks:
- `app/src/display/HTMLBook.js` `readFromReader`: where the progress callback
  block already computes `pct`, add `if (typeof ImportStats !== "undefined") ImportStats.count("chunks", 1);`
  (top of the function, after the progress block — fires once per chunk cycle).
- `app/src/io/Database.js` `write` and `writeBatch`, first line:
  `if (typeof window !== "undefined" && window.ImportStats && ImportStats.active) ImportStats.count("dbWrites", 1);`
  Note `ImportStats` lives in FileImporter.js which loads AFTER Database.js —
  hence the guarded `window.ImportStats` form, and add `window.ImportStats = ImportStats;`
  right after the object literal in P0.1.

### P0.3 Acceptance
1. `node --check` on both edited files; `./build.sh`; install + Luna restart.
2. Run the benchmark protocol. Exactly ONE `IMPORTSTATS status=ok` line
   appears; `load+parse+cover+store ≈ total`; `chunks` ≈ 30–45; `dbWrites` ≈
   chunks + images + 1 (meta).
3. Run it 3×, fresh launch each time. Record all three lines in a comment in
   this file under "Baseline". This is the baseline every later phase compares
   against.
4. Import a deliberately broken file (rename a .jpg to .epub):
   one `IMPORTSTATS status=error` line, normal error popup.

---

## P1 — Killable, honest imports (fixes F1, F2, F3, F4, F5)

Goal: an import can be cancelled; a crashed import reports an error instead of
hanging forever; only one import can run; the multi-book queue never stalls.

### P1.1 New file: `app/app/common/ImportSession.js`
Add to `app/depends.js` immediately BEFORE `"app/common/FileImporter.js"`.

```js
/**
 * ImportSession - single-flight token for the import pipeline.
 * The engine (EpubReader/HTMLBook/Inflate defer-chains) captures
 * ImportSession.current at construction time; every chain step checks
 * session.cancelled and stops dead if set. Read-time constructions (opening
 * a book) capture null and are never affected.
 * See IMPORT-AUDIT.html F1/F2/F3.
 */
function ImportSession() {
	this.cancelled = false;
	this.failReason = null;
	this.onFail = null;       // set by FileImporter; routes to the import callback
	this.startedAt = Date.now();
}
ImportSession.current = null;
ImportSession.begin = function() {
	if (ImportSession.current) { return null; }   // single-flight lock (F3)
	ImportSession.current = new ImportSession();
	return ImportSession.current;
};
ImportSession.endCurrent = function() { ImportSession.current = null; };
ImportSession.prototype.cancel = function(reason) {
	if (this.cancelled) { return; }
	this.cancelled = true;
	this.failReason = reason || "cancelled";
	enyo.warn("ImportSession cancelled: " + this.failReason);
};
ImportSession.prototype.fail = function(err) {
	if (this.cancelled) { return; }
	this.cancelled = true;
	this.failReason = "error: " + (err && err.message ? err.message : err);
	enyo.error("ImportSession failed: " + this.failReason + (err && err.stack ? "\n" + err.stack : ""));
	if (this.onFail) { this.onFail(this.failReason); }
};
```

### P1.2 FileImporter owns the session lifecycle
In `importEpub` (and mirrored in `_processEpubArrayBuffer`):

1. After the extension check, before creating `File`:
```js
	var session = ImportSession.begin();
	if (!session) {
		callback(null, "An import is already running.");
		return;
	}
	this.session = session;   // exposed so Main's watchdog can cancel it
```
2. Create ONE choke point so the session always ends exactly once — wrap
   `callback` immediately after the block above:
```js
	var rawCallback = callback;
	callback = function(book, error) {
		if (ImportSession.current === session) { ImportSession.endCurrent(); }
		ImportStats.end(error ? (session.cancelled ? "cancelled" : "error") : "ok");
		rawCallback(book, error);
	};
	session.onFail = function(reason) {
		callback(null, reason);
	};
```
   Then REMOVE the individual `ImportStats.end(...)` lines added in P0 (the
   choke point replaces them). `ImportStats.begin` stays where it is.
3. Guard the two success-side writes (F5): in the HTMLBook completion
   callback, FIRST line:
```js
	if (session.cancelled) { return; }   // do not add cancelled imports to the library
```
   (`saveBookMetadata` and the success `callback` now sit behind this guard.)

### P1.3 Engine capture + step guards (the core of F1/F2)
Pattern — identical everywhere. At CONSTRUCTION time capture the session:
```js
	// In EpubReader constructor and HTMLBook constructor, near the top:
	this.importSession = (typeof ImportSession !== "undefined") ? ImportSession.current : null;
```
At the TOP of every chain-step function body, insert the guard/trap:
```js
	var _sess = this.importSession;
	if (_sess && _sess.cancelled) { return; }   // abandoned import: stop dead (F1)
	try {
```
and at the BOTTOM of the function body:
```js
	} catch (_e) {
		if (_sess) { _sess.fail(_e); } else { throw _e; }
	}
```
Exact functions to wrap (whole body inside the try, keep `function(...)` line
and final `}` outside):

| File | Function |
|---|---|
| `app/src/pdb/EpubReader.js` | `parseRootfiles` |
| | `getDataContent` (also wrap the inner `loadWorker` body the same way, reusing the same `_sess`) |
| | `filterChapter` |
| | `setStreamOK` |
| `app/src/display/HTMLBook.js` | `readFromReader` (guard AFTER the `isRecursiveCall` reset block so a fresh import initializes first; the constructor capture already happened) |
| | inner `tagWorker` and `storeWorker` closures (reuse `_sess` from the enclosing scope; only the cancelled-check + try/catch, no re-capture) |

`Inflate.js` `uncompressAsync` — the inner `decWorker` cannot see an
instance session. Capture at entry instead:
```js
	var _sess = (typeof ImportSession !== "undefined") ? ImportSession.current : null;
```
then the same guard/trap inside `decWorker`. (When a book is opened for
reading, `ImportSession.current` is null unless an import is running; a
cancelled import's inflate must die, and read-time inflate — legacy zLib
buffers only — is unaffected because... it CAN capture a live session if the
user reads during an import. To avoid that false coupling, in
`ZipLocalFile.uncompressAsync` the capture must happen only when the caller
passes it: **simpler rule — capture in EpubReader.getDataContent** where
`uncompressAsync` is called, and pass down: change the call to
`zipped.file.uncompressAsync(loadWorker.bind(this, state, load), this.importSession)`
and thread the second argument through `ZipLocalFile.uncompressAsync(callback, session)`
into `Inflate.uncompressAsync(source, isGzip, callback, session)`. Default
null. This keeps reading 100% decoupled.)

IMPORTANT sizing note: `filterChapter` and `readFromReader` already contain
`return` statements; wrapping in try/catch does not change their control flow.
Watch indentation only enough to keep the file readable — tabs, CRLF.

### P1.4 Main.js — watchdog, queue, cancel button
File: `app/app/Main.js`, inside `importNext()`.

1. Watchdog timeout branch (currently ~line 959–968): after
   `self.hideSpinnerPopup();` add:
```js
					if (importer.session) { importer.session.cancel("watchdog timeout"); }
					setTimeout(importNext, 100);   // F4: keep the multi-book queue moving
```
2. Lock feedback (F3): at the very top of `importMultipleEpubs`:
```js
		if (typeof ImportSession !== "undefined" && ImportSession.current) {
			this.showError("Import", "An import is already running. Please wait for it to finish.");
			return;
		}
```
3. Spinner rework (F15 — Jon's requirements, verbatim: modal, a Cancel button
   that actually cancels with no zombies, always centered, native Enyo
   controls where possible). Current declaration is `Main.js` line ~74:
```js
	{name: "spinnerPopup", kind: "Popup", className: "spinner-popup", lazy: false, dismissWithClick: false, modal: false, scrim: false, components: [
		{kind: "VFlexBox", align: "center", components: [
			{kind: "Spinner", name: "importSpinner", showing: true},
			{name: "spinnerText", content: "Loading...", style: "color: white; margin-top: 10px; font-size: 16px;"}
		]}
	]},
```
   Replace with a native `ModalDialog` (Enyo 1's built-in modal popup —
   centered by the framework, scrim included, blocks interaction behind it):
```js
	{name: "spinnerPopup", kind: "ModalDialog", caption: $L("Importing"), lazy: false, dismissWithClick: false, components: [
		{kind: "VFlexBox", align: "center", components: [
			{kind: "SpinnerLarge", name: "importSpinner", showing: true},
			{name: "spinnerText", content: "Loading...", style: "margin-top: 10px; font-size: 16px; text-align: center;"},
			{kind: "Button", content: $L("Cancel"), className: "enyo-button-negative", style: "margin-top: 14px; min-width: 180px;", onclick: "cancelActiveImport"}
		]}
	]},
```
   Notes for the implementer:
   - `ModalDialog` and `SpinnerLarge` are both confirmed present in this
     app's vendored `app/enyo/build/enyo-build.js` (grep-verified). If
     `ModalDialog`'s default styling clashes with the app theme, fallback:
     keep `kind: "Popup"` but set `modal: true, scrim: true` and call
     `openAtCenter()` — both are native Popup features.
   - Re-centering on content change (Jon's #3): after `setContent` in
     `showSpinnerPopup`, when the popup is already open call any of the
     framework's re-position methods that survive a size change; on Enyo 1
     Popup this is `this.$.spinnerPopup.center()` if present, else
     `openAtCenter()` guarded so it does not replay the open animation —
     check what the build provides (`grep -n 'center:' enyo-build.js`) and
     use the native method rather than hand-positioning. To make re-centering
     largely unnecessary, also give the text a fixed-width container
     (`style: "width: 320px;"` on the VFlexBox) so message changes do not
     change the popup's size.
   - The `spinnerText` `color: white` inline style must go (ModalDialog has a
     light surface; let it inherit).
   - `hideSpinnerPopup` keeps working unchanged (`close()`).
   Handler on the Main kind:
```js
	cancelActiveImport: function() {
		if (typeof ImportSession !== "undefined" && ImportSession.current) {
			ImportSession.current.cancel("user cancelled");
		}
		// The FileImporter choke-point callback fires via onFail?  No: cancel()
		// does NOT call onFail (only fail() does). The chain just stops; the
		// per-book callback never fires. So the QUEUE must be advanced here:
		this.hideSpinnerPopup();
	},
```
   **Queue subtlety:** `cancel()` stops the chain silently; Main's per-book
   `importCallbackFired` stays false and `importNext` would never continue.
   Fix by polling inside `keepAlive`'s watchdog arm — simpler and already
   present every few seconds: at the TOP of the `importWatchdog` setTimeout
   body add:
```js
					if (importer.session && importer.session.cancelled && !importCallbackFired) {
						importCallbackFired = true;
						errors.push(displayName + ": " + importer.session.failReason);
						current++;
						setTimeout(importNext, 100);
						return;
					}
```
   AND to avoid waiting up to 3 minutes for that check, `cancelActiveImport`
   should also force the watchdog to re-fire soon; easiest correct version:
   store the active `keepAlive` on `self._importKeepAlive = keepAlive;` when
   arming (one line after `keepAlive();` at ~line 971), and have
   `cancelActiveImport` call `this._importKeepAlive && this._importKeepAlive("Cancelling...")`
   after cancelling — keepAlive re-arms a fresh watchdog; better still, give
   the watchdog a short path: in `keepAlive`, if
   `importer.session && importer.session.cancelled`, use `timeoutMs = 500`.

### P1.5 Acceptance (all on device, fresh Luna restart)
1. **Baseline unchanged:** benchmark 3×; totals within ±10% of P0 baseline.
2. **Cancel works — the zombie test (F1):** start benchmark import, tap
   Cancel at ~30%. Spinner closes ≤2s later; `IMPORTSTATS status=cancelled`
   line appears; immediately re-import the same book → completes at baseline
   speed. A slower second run means the first chain is still alive — the
   cancel implementation has failed this test and must not ship.
2b. **Spinner is modal + centered:** while an import runs, taps on the
   library behind the dialog do nothing (no book opens, no second picker);
   the dialog is horizontally and vertically centered and STAYS centered as
   the progress text changes from short ("Reading file...") to long
   ("Importing 1 of 3: Processing text 45%").
3. **Error surfaces:** temporarily add `if (state.currPos > 8192) { throw new Error("TEST"); }`
   to `filterChapter`, build, import → user sees an error popup naming the
   book (not an eternal spinner); `IMPORTSTATS status=error`. REMOVE the
   throw, rebuild, confirm benchmark passes again.
4. **Queue survives:** multi-select 3 books where the 1st is the broken .jpg
   file from P0.4 → books 2 and 3 still import; summary popup reports 1 failed.
5. **Lock:** while a big import runs, tap Import again → "already running"
   message, no second chain (verify: only one set of chunk progress in logs).
6. **Reading unaffected:** while an import runs, open an existing book, turn
   pages, return to library. Import completes; book reading was normal.
7. **PWA parity:** in a desktop browser, import an epub → works; cancel path
   not required in PWA UI but the session lifecycle must not break imports.
8. All four canary books import and open.

---

## P2 — Pre-flight + storage hygiene (fixes F6, F13; arms F7/F8)

### P2.1 Delete the old DB before re-import (stops the F6 leak growing)
In BOTH FileImporter pipelines, after `var dbName = ...` is computed and
before `continueWithCover` / `new HTMLBook`:
```js
	// F6: re-importing a book previously stranded its old DB (dbName embeds a
	// timestamp). Purge the old copy before writing the new one.
	var oldDbName = null;
	try {
		var lib = JSON.parse(localStorage.getItem("ereader_library") || "[]");
		for (var li = 0; li < lib.length; li++) {
			if (lib[li].bookFilePath === filePath && lib[li].bookDbName && lib[li].bookDbName !== dbName) {
				oldDbName = lib[li].bookDbName;
				break;
			}
		}
	} catch (e2) {}
```
Then make the HTMLBook construction wait on the purge when needed:
```js
	var proceed = function() { /* existing continueWithCover(...) flow */ };
	if (oldDbName) {
		enyo.log("Purging replaced book DB: " + oldDbName);
		HTMLBook.deleteBook(oldDbName, proceed);
	} else {
		proceed();
	}
```
(`HTMLBook.deleteBook` → `deleteSelfFromDB` → `purgeDB` empties tables and
vacuums; WebSQL cannot delete the file but it shrinks to a few KB.)
NOTE: in `_processEpubArrayBuffer` the dedup key is `filePath` (the URL/name
passed in) — same lookup works.

### P2.2 DB registry for future orphan sweeps
- On successful import (inside the guarded success block from P1.2), append
  `{db: dbName, asin: bookData.asin, t: Date.now()}` to localStorage key
  `ereader_dbs` (create array if absent; cap at 200 entries, drop oldest).
- In `Main.js` `create()`, schedule once, 15s after launch
  (`setTimeout(..., 15000)`): read `ereader_dbs`, read the library, and for
  every registry entry whose `db` is NOT any book's `bookDbName` and whose
  `t` is older than 24h: `HTMLBook.deleteBook(entry.db, ...)` sequentially
  (chain the callbacks, one at a time), then rewrite the registry without the
  purged entries. Log one summary line: `enyo.warn("DB sweep: purged N orphans")`
  only when N > 0.
- Pre-existing orphans (created before the registry) are unreachable from JS.
  Document only; a one-time novacom cleanup can remove files under
  `/media/internal/.app-storage/file_..._papyrus_0/` for books not in the
  library, but file→book mapping requires opening each DB — out of scope.

### P2.3 Pre-flight report + decisions
Add `FileImporter.prototype.preflight = function(reader)` called in BOTH
pipelines right after metadata extraction. It must only READ
`reader.structure`:
```js
	// Returns a summary of what this book will cost to import, and flags
	// conditions the engine is known to handle badly (see F7/F8).
	FileImporter.prototype.preflight = function(reader) {
		var rf = (reader.structure && reader.structure.rfData[0]) || null;
		var out = { chapters: 0, textBytes: 0, images: 0, imageBytes: 0, bigImages: 0, dataUri: false };
		if (!rf) { return out; }
		var i, j, d;
		out.chapters = rf.chapters.length;
		for (i = 0; i < rf.chapters.length; i++) {
			d = rf.chapters[i].data;
			if (!d) { continue; }
			out.textBytes += d.length;
			// byte-scan for "data:" (0x64 61 74 61 3A) — flags giant inline tags (F7/F8 risk)
			if (!out.dataUri) {
				for (j = 0; j + 4 < d.length; j++) {
					if (d[j] === 0x64 && d[j+1] === 0x61 && d[j+2] === 0x74 && d[j+3] === 0x61 && d[j+4] === 0x3A) { out.dataUri = true; break; }
				}
			}
		}
		for (i = 0; i < rf.images.length; i++) {
			out.images++;
			var sz = (rf.images[i].data && rf.images[i].data.length) || 0;
			out.imageBytes += sz;
			if (sz > 1048576) { out.bigImages++; }
		}
		return out;
	};
```
Uses:
1. Log it once: `enyo.warn("PREFLIGHT " + JSON.stringify(pf));` and feed
   `ImportStats.count` for `textKB`, `images`.
2. Honest ETA in the spinner: with the P0 baseline, compute
   `etaSec = Math.round(pf.textBytes / RATE)` where `RATE` is a constant
   calibrated from baseline (`textBytes / storePhaseSeconds`, hardcode the
   measured value with a comment). Show once via
   `ping("Processing content (about " + eta + ")...")` — REMEMBER the
   phase-string matcher rule from Ground Rules ("Processing" prefix kept).
3. If `pf.dataUri` on webOS: `enyo.warn` + one banner
   (`enyo.windows.addBannerMessage`) — "This book has embedded images and may
   not import completely." (Actual F7/F8 fixes are P3; this is honest notice.)

### P2.4 Negative-cache skipped images (F13)
`app/src/display/HTMLBook.js` `tagWorker`, the `bytes == null` branch
(currently warns and `break`s): add `this.imgNameBuffer.push(label);` before
the `break`, so each missing/oversized image is attempted once per import
instead of once per occurrence.

### P2.5 Acceptance
1. Benchmark ±10% of baseline; canaries pass.
2. Import Star Trek, then import it AGAIN. Device check:
```
printf 'du -sh /media/internal/.app-storage/file_.media.cryptofs.apps.usr.palm.applications.com.palm.codepoet.papyrus_0/\nexit\n' | novacom open tty://
```
   Directory size must NOT grow by ~4MB on the re-import (old DB purged).
   Library shows exactly one entry.
3. `PREFLIGHT` line appears with plausible numbers (chapters=22 for Star Trek).
4. Kill the app mid-import; relaunch; wait 15s+; verify a
   `DB sweep: purged 1 orphans` line appears on the sweep after 24h — for the
   test, temporarily lower the age threshold to 60s, verify, then restore.
5. Import a book with a >1MB non-cover image: exactly ONE
   "skipping oversized image" warn per image (not per occurrence).

---

## P3 — Performance (each item = its own build + benchmark; revert any item that regresses >15%)

Prerequisite: P0 baseline + P1 landed, so every claim below is measurable and
every experiment is killable.

### P3.1 Time-sliced trampoline for the hot chains
Add to `ImportSession.js`:
```js
	// Run chain steps synchronously in ~40ms slices instead of paying the
	// ~10ms setTimeout floor on EVERY step (~400 steps/import). Yields to the
	// event loop between slices so UI/watchdog stay alive.
	ImportSession.SLICE_MS = 40;
	ImportSession.MAX_SYNC = 20;          // stack-depth cap for recursive chains
	ImportSession._sliceT0 = 0;
	ImportSession._syncDepth = 0;
	ImportSession.step = function(fn) {
		var now = Date.now();
		if (ImportSession._sliceT0 === 0) { ImportSession._sliceT0 = now; }
		if (now - ImportSession._sliceT0 < ImportSession.SLICE_MS &&
				ImportSession._syncDepth < ImportSession.MAX_SYNC) {
			ImportSession._syncDepth++;
			try { fn(); } finally { ImportSession._syncDepth--; }
		} else {
			ImportSession._sliceT0 = 0;
			ImportSession._syncDepth = 0;
			setTimeout(fn, 0);
		}
	};
```
Replace `X.bind(...).defer()` with `ImportSession.step(X.bind(...))` ONLY at
these sites (all are import-only paths):
- `EpubReader.js`: `parseRootfiles` self-defer (2 sites), `getDataContent`
  self/loadWorker defers (4 sites), `filterChapter` self-defer (1 site),
  `filterMarkup`'s per-chapter kickoff defer (1 site)
- `HTMLBook.js`: `tagWorker` tail defer (1 site), the initial
  `tagWorker.bind(...).defer()` (1 site)
- `Inflate.js`: `decWorker` defers (2 sites) — only when a session was passed
  (P1.3); otherwise keep `.defer()` (read-time behavior unchanged):
  `session ? ImportSession.step(next) : next.defer()` shape.
Do NOT touch defers outside the import path.
Expected: `IMPORTSTATS` total drops by roughly the old defer tax (5–15s on a
90s baseline); `chunks`/`dbWrites` unchanged.

### P3.2 Batch buffer writes
`HTMLBook.js`: give the instance `this._pendingWrites = [];` in
`loadDefaults`. In `saveBufferData`, when `this.importSession` is non-null:
push `{name: name, value: save}` and call the callback immediately; when
`_pendingWrites.length >= 8`, flush first via
`this.bookDB.writeBatch(batch, callback)` (batch = the 8, cleared before the
call). In `finish()` (readFromReader), flush any remainder with `writeBatch`
and only THEN `saveMetaData()` + the completion callback (chain the
callbacks; metadata must be the last write). Read-time path
(`importSession == null`) keeps the old direct `write` — buffers are loaded
back during reading and must not sit in a pending array.
Expected: `dbWrites` drops from ~40 to ~8–10; measure the `store` phase.

### P3.3 F7/F8 emergency valves (correctness cliffs)
- **F7 (filterChapter quadratic carry):** at the carry site
  (`if (html.droppedBytes > 0) { ... }`), add a cap:
```js
		if (html.droppedBytes > 3 * EpubReader.chunkSize) {
			// A "tag" larger than 12KB is not a tag we will ever render
			// (giant data-URI / unterminated markup). Emit it as escaped text
			// instead of re-parsing an ever-growing buffer (quadratic).
			var runaway = chapter.data.slice(state.currPos - html.droppedBytes, state.currPos);
			var runTxt = bytesToString(runaway).replace(/</g, "&lt;").replace(/>/g, "&gt;");
			concatArray(state.filterData, stringToBytes(runTxt));
			state.extraBytes.length = 0;
		} else { /* existing carry */ }
```
- **F8 (HTMLBook truncation):** in `readFromReader`, the
  `byteBuf.length - dropped <= 0` branch currently calls `finish()`. Change
  to: if `currPos + byteBuf.length < this.reader.getLength()` (i.e., NOT
  actually at end of book), log
  `enyo.error("HTMLBook: giant tag at pos " + currPos + ", skipping ahead")`,
  advance `currPos += byteBuf.length` (skip the unparseable span), pass empty
  `openTags`, and continue the loop instead of finishing. Only finish when
  genuinely at end.
Both valves MUST be verified against all canaries (they change parsing edge
behavior). Craft a test epub with a 100KB base64 `src` data-URI img to prove:
imports in bounded time, book text after the image survives.

### P3.4 Re-evaluate chapter-break chunking (F9)
Only after P3.1–P3.3: benchmark 3× with `chapterPageBreaks` ON vs OFF
(fresh launch each). If ON ≤ 1.25× OFF, it may return to default-on
(flip the four sites listed in Settings.js/EpubRenderer.js/HTMLBook.js/
PageFitter.js — see git history around builds v193/v194 for the exact lines).
If not, keep default-off and record the per-phase numbers in the audit doc.

---

## Automated harness

`tools/import-bench.js` runs the REAL engine sources over a directory of books
in Node (jsdom for DOM, in-memory fake Database) and reports per-book status,
timing, work counts, and a truncation check. Use it after EVERY change:

```
NODE_PATH=<dir containing jsdom> node tools/import-bench.js /Users/jonwise/Desktop/BooksToTest
```
Exit code is non-zero if any book fails or truncates. `--json out.json` dumps
full results; `--book <substr>` filters.

**It catches:** parse correctness, silent truncation (F8), chapter-break math,
exceptions swallowed inside `.defer()` chains, and relative work volume.
**It does NOT predict device wall-clock** — compare the `defers` and `dbWrites`
columns as the portable proxies, then confirm on device.

### Harness baseline @ P0 (pre-P1)

```
book                              config      status           ms  defers  chunks  writes  chaps  breaks   trunc
Being Human - Star Trek           breaks-OFF  ok             1164     490      30      42     22       1      ok
Being Human - Star Trek           breaks-ON   ok             1157     514      38      50     22      15      ok
Catcher in the Rye                breaks-OFF  ok              583     237      29      29     10       1      ok
Catcher in the Rye                breaks-ON   ok              586     246      32      32     10       9      ok
Cognition in the Wild             breaks-OFF  ok             4030    2902      86     133    395       1      ok
Cognition in the Wild             breaks-ON   ok             3922    2941      99     146    395      96      ok
Goosebumps Welcome To Dead House  breaks-OFF  ok              270     161      10      11     20       1      ok
Goosebumps Welcome To Dead House  breaks-ON   ok              271     167      12      13     20      11      ok
Kurt Vonnegut - Slaughterhouse-5  breaks-OFF  ok              493     175      23      23      3       1      ok
Kurt Vonnegut - Slaughterhouse-5  breaks-ON   ok              486     178      24      24      3       3      ok
Mad Libs 10 (1979)                breaks-OFF  ok              181     142       5       5     30       1      ok
Mad Libs 10 (1979)                breaks-ON   ok              176     145       6       6     30       5      ok
```

Findings from this baseline:
- **breaks-ON costs only ~5% more defers** (490→514 Star Trek; 2902→2941
  Cognition). F9's 10–20× device penalty is therefore NOT explained by work
  volume — the mechanism remains unidentified and the toggle stays default-off.
- **Cognition in the Wild ships 36 zero-byte images** (verified in the zip:
  `usize=0, csize=2`). 395 of its 442 image references resolve to nothing, and
  each one currently costs a defer + a linear `getImage` scan + a log line
  (F13). This is the single biggest identified waste on that canary book.
- No book truncates today, so P3.3's F8 valve is a latent-risk fix, not an
  active-bug fix — keep it late in the order.

### Harness results after P0–P3 (same machine, same books)

```
book                              config      status      ms  timers   steps  writes  trunc  reopen
Being Human - Star Trek           breaks-OFF  ok         725      27     458      17     ok      ok
Being Human - Star Trek           breaks-ON   ok         659      26     474      18     ok      ok
Catcher in the Rye                breaks-OFF  ok         384      19     206       5     ok      ok
Cognition in the Wild             breaks-OFF  ok        1630      62    2419      59     ok      ok
Goosebumps Welcome To Dead House  breaks-OFF  ok         149      10     149       4     ok      ok
Kurt Vonnegut - Slaughterhouse-5  breaks-OFF  ok         300      15     150       4     ok      ok
Mad Libs 10 (1979)                breaks-OFF  ok          67       6     135       2     ok      ok
```

Change vs the P0 baseline — `timers` is the portable proxy for device cost
(each one was a ~10ms floor on device):

| book | timers | db writes | harness ms |
|---|---|---|---|
| Star Trek | 490 → **27** (18×) | 42 → **17** | 1164 → 725 |
| Cognition | 2507 → **62** (40×) | 133 → **59** | 4030 → 1630 |
| Mad Libs | 142 → **6** (24×) | 5 → **2** | 181 → 67 |

Pathological set (`tools/make-pathological-epubs.js`), all now import cleanly
with content intact:

| case | before | after |
|---|---|---|
| giant data: URI (F8) | silently lost 5,078 bytes, reported success | 0 lost, oversized tag skipped, tail intact |
| unclosed tag, 279KB chapter (F7/F16) | 2,016 ms, quadratic scaling | 604 ms, linear scaling |

`reopen` column confirms every book is re-openable from storage with matching
length and readable first/last buffers — i.e. batched writes really persisted.

### Device baseline (fill in on a TouchPad, benchmark protocol above)

```
run 1: IMPORTSTATS ...
run 2: IMPORTSTATS ...
run 3: IMPORTSTATS ...
```
