/**
 * ImportSession - single-flight cancellation token for the import pipeline.
 *
 * WHY THIS EXISTS (see IMPORT-AUDIT.html F1/F2/F3):
 * The import engine is a chain of thousands of tiny .defer()'d steps spread
 * across EpubReader, HTMLBook and Inflate.  Before this existed there was NO
 * way to stop a running chain: the watchdog "abandoned" a stuck import by
 * ignoring its callback while the chain kept parsing and writing to WebSQL for
 * minutes afterwards, competing with whatever the user did next.  Stacked
 * zombie chains were the single largest source of the wildly nondeterministic
 * import times (90s one run, 20+ minutes the next).
 *
 * HOW IT WORKS:
 *   - FileImporter calls ImportSession.begin() once per import.  It returns
 *     null if an import is already running (single-flight lock).
 *   - Engine objects capture ImportSession.current AT CONSTRUCTION TIME.
 *     Objects built for READING a book capture null (no import running), so
 *     reading is never affected by import cancellation.
 *   - Every chain step checks session.cancelled and returns immediately.
 *   - Every chain step is wrapped so a thrown exception calls session.fail(),
 *     which reports the error to the user instead of silently killing the
 *     chain and hanging the UI forever.
 */
function ImportSession() {
	this.cancelled = false;
	this.failReason = null;
	this.onFail = null;        // set by FileImporter; routes to the import callback
	this.startedAt = Date.now();
}

/** The import currently running, or null. Engine objects capture this. */
ImportSession.current = null;

/**
 * Starts a new import session, or returns null if one is already running.
 */
ImportSession.begin = function() {
	if (ImportSession.current) {
		return null;
	}
	ImportSession.current = new ImportSession();
	return ImportSession.current;
};

/** Clears the active session. Safe to call more than once. */
ImportSession.endCurrent = function() {
	ImportSession.current = null;
};

/**
 * Stops the chain silently (user cancel, watchdog timeout, app teardown).
 * Does NOT call onFail - the caller that cancels is responsible for whatever
 * UI follow-up it wants, so a cancel never looks like a crash.
 */
ImportSession.prototype.cancel = function(reason) {
	if (this.cancelled) { return; }
	this.cancelled = true;
	this.failReason = reason || "cancelled";
	ImportSession.flushCancelled();
	// Release the single-flight slot immediately.  A cancel stops the chain
	// SILENTLY - the per-import completion callback (which is what normally
	// frees the slot) never runs - so without this the lock stayed held and
	// every later import was refused with "an import is already running"
	// until the app was restarted.
	// Safe to release now: the engine holds a reference to this object and
	// keeps checking .cancelled, and flushCancelled() has already dropped its
	// queued work, so a new import cannot be disturbed by the dead one.
	if (ImportSession.current === this) { ImportSession.endCurrent(); }
	enyo.warn("ImportSession cancelled: " + this.failReason);
};

/**
 * Stops the chain because a step threw. Reports through onFail so the user
 * sees a real error instead of an eternal spinner.
 */
ImportSession.prototype.fail = function(err) {
	if (this.cancelled) { return; }
	this.cancelled = true;
	this.failReason = (err && err.message) ? err.message : String(err);
	ImportSession.flushCancelled();
	// Release the slot before reporting, for the same reason as cancel():
	// the failure path must never be able to strand the single-flight lock.
	// endCurrent() is idempotent, so the completion callback below is free to
	// release it again.
	if (ImportSession.current === this) { ImportSession.endCurrent(); }
	enyo.error("ImportSession failed: " + this.failReason +
		((err && err.stack) ? ("\n" + err.stack) : ""));
	if (this.onFail) {
		this.onFail(this.failReason);
	}
};

/**
 * Helper for engine objects: capture the active session at construction.
 * Returns null when no import is running (i.e. normal book reading).
 */
ImportSession.capture = function() {
	return (typeof ImportSession !== "undefined") ? ImportSession.current : null;
};

/**
 * Schedules the next step of a deferred chain, guarded by a session.
 *
 * This replaces bare `fn.bind(...).defer()` at every step boundary in the
 * import engine, and is the single place that gives us:
 *   1. cancellation - a cancelled session simply stops scheduling, so the
 *      chain dies instead of running on as a zombie (F1);
 *   2. error reporting - a step that throws routes to session.fail() and the
 *      user sees an error, instead of the exception vanishing into the
 *      setTimeout callback and hanging the UI forever (F2).
 *
 * With no session (the book-READING path constructs engine objects while no
 * import is running) this is exactly the old `.defer()` behavior.
 *
 * @param {ImportSession|null} session the owning session, or null
 * @param {Function} boundFn a fully-bound zero-argument step
 */
ImportSession.deferStep = function(session, boundFn) {
	if (session && session.cancelled) { return; }

	// No session == a book is being READ, not imported. Keep the original
	// Function.prototype.defer semantics exactly, so page turns and
	// pagination behave byte-for-byte as they always have.
	if (!session) {
		setTimeout(boundFn, 10);
		return;
	}

	ImportSession._queue.push({ session: session, fn: boundFn });
	if (!ImportSession._draining) {
		ImportSession._draining = true;
		setTimeout(ImportSession._drain, 0);
	}
};

/**
 * How long the import may hold the JS thread before yielding, in ms.
 * Two frames' worth: long enough that per-step scheduling overhead becomes
 * negligible, short enough that the Cancel button still feels immediate.
 */
ImportSession.SLICE_MS = 30;

ImportSession._queue = [];
ImportSession._draining = false;

/**
 * Trampoline for import chain steps.
 *
 * The engine used to pay a ~10ms setTimeout floor on EVERY step, and a book
 * takes hundreds to thousands of steps (a 470KB novel ~490, an illustrated
 * textbook ~2500) - i.e. 5 to 25 seconds of an import spent purely waiting on
 * timers.  Here steps run back-to-back until the slice expires, then yield
 * once so the UI can breathe.
 *
 * Steps are QUEUED rather than called recursively: a chain step schedules its
 * own successor, so running them nested would grow the stack by one frame per
 * step and overflow old JavaScriptCore long before the book finished.
 */
ImportSession._drain = function() {
	var start = Date.now();
	try {
		while (ImportSession._queue.length) {
			var item = ImportSession._queue.shift();
			if (item.session.cancelled) { continue; }
			try {
				item.fn();
			} catch (e) {
				item.session.fail(e);
			}
			if (Date.now() - start >= ImportSession.SLICE_MS) { break; }
		}
	} finally {
		// Always re-arm or clear the flag, even if a fail() handler threw;
		// otherwise the queue would stall permanently.
		if (ImportSession._queue.length) {
			setTimeout(ImportSession._drain, 0);
		} else {
			ImportSession._draining = false;
		}
	}
};

/**
 * Drops any queued work belonging to cancelled sessions. Called when a session
 * ends so a long queue from an abandoned import cannot outlive it.
 */
ImportSession.flushCancelled = function() {
	var q = ImportSession._queue, keep = [];
	for (var i = 0; i < q.length; i++) {
		if (!q[i].session.cancelled) { keep.push(q[i]); }
	}
	ImportSession._queue = keep;
};

/**
 * Runs a step immediately (not deferred) under the same protection. Used at
 * chain ENTRY points, which are called directly rather than scheduled.
 */
ImportSession.runStep = function(session, boundFn) {
	if (session && session.cancelled) { return false; }
	if (!session) { boundFn(); return true; }
	try {
		boundFn();
	} catch (e) {
		session.fail(e);
		return false;
	}
	return true;
};
