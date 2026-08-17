/**
 * FileImporter - ePub file import handler
 *
 * Handles importing ePub files into the library. Uses Preader's EpubReader
 * for parsing and HTMLBook for storage.
 */

// ByteReader implementation backed by an ArrayBuffer (Uint8Array).
// Used by the browser import path so ZipFile/EpubReader work unchanged.
function ArrayBufferByteReader(buffer) {
    this._bytes = new Uint8Array(buffer);
    this.ready = true;
    this.failure = false;
}
ArrayBufferByteReader.prototype = new ByteReader();
ArrayBufferByteReader.prototype.read = function(start, len) {
    if (!len) len = 1;
    if (start < 0 || start >= this._bytes.length || len <= 0) return null;
    var end = Math.min(start + len, this._bytes.length);
    var buf = [];
    for (var i = start; i < end; i++) buf.push(this._bytes[i]);
    return buf;
};
ArrayBufferByteReader.prototype.readIsAsync = function() { return false; };
ArrayBufferByteReader.prototype.getLength = function() {
    return this._bytes ? this._bytes.length : 0;
};
ArrayBufferByteReader.prototype.close = function() { this._bytes = null; };
ArrayBufferByteReader.prototype.getBasename = function() { return this._name || ''; };

/**
 * Import instrumentation (see IMPORT-AUDIT.html / IMPORT-REWORK-PLAN.md P0).
 *
 * Emits ONE warn-level summary line per import so import regressions are
 * diagnosable from a single log line at the device's default log level,
 * instead of requiring a live debugging session.  phase() accumulates the
 * time since the previous phase call into the named bucket, so each phase
 * marker is placed at the END of the phase it names.
 */
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
// Database.js loads before this file, so its counter hooks reach ImportStats
// through window rather than the bare identifier.
if (typeof window !== "undefined") { window.ImportStats = ImportStats; }

function FileImporter() {
	this.library = null;
}

/**
 * Import an ePub file
 * @param {String} filePath - Path to the ePub file
 * @param {Function} callback - Called with (bookData, error)
 */
FileImporter.prototype.importEpub = function(filePath, callback, keepAlive) {
	var self = this;
	var ping = keepAlive || function() {};

	// Browser environment: filePath is a native File object from the FilePicker shim
	if (typeof filePath !== 'string') {
		self._importEpubFromBrowserFile(filePath, callback, ping);
		return;
	}

	enyo.log("FileImporter.importEpub: " + filePath);

	// Validate file path
	if (!filePath || filePath.length === 0) {
		callback(null, "No file path provided");
		return;
	}

	// Check file extension
	if (filePath.toLowerCase().indexOf(".epub") === -1) {
		callback(null, "File is not an ePub");
		return;
	}

	// Single-flight lock: a second concurrent import would compete for the
	// JS thread and the WebSQL queue, making both crawl (audit F3).
	var session = ImportSession.begin();
	if (!session) {
		callback(null, "An import is already running.");
		return;
	}
	this.session = session;   // exposed so Main's watchdog/Cancel can stop it

	ImportStats.begin(filePath);

	// Single choke point for import completion.  Every success and every
	// failure path below routes through here, so the session is released and
	// the stats line emitted exactly once no matter how the import ends.
	var rawCallback = callback;
	var finished = false;
	callback = function(book, error) {
		if (finished) { return; }
		finished = true;
		if (ImportSession.current === session) { ImportSession.endCurrent(); }
		ImportStats.end(error ? (session.cancelled ? "cancelled" : "error") : "ok");
		rawCallback(book, error);
	};
	// A step that throws deep inside a defer chain reports here instead of
	// silently killing the chain and hanging the UI forever (audit F2).
	session.onFail = function(reason) {
		callback(null, reason);
	};

	// Convert path to file:// URL if needed, encoding spaces and special characters
	var fileUrl = filePath;
	if (fileUrl.indexOf("file://") !== 0 && fileUrl.indexOf("http") !== 0) {
		// Encode the path portion for URLs with spaces/special chars
		fileUrl = "file://" + encodeURI(filePath);
	} else if (fileUrl.indexOf("file://") === 0) {
		// Already has file:// prefix, but path might need encoding
		var pathPart = filePath.substring(7); // Remove "file://"
		fileUrl = "file://" + encodeURI(pathPart);
	}

	enyo.log("Loading file URL: " + fileUrl);

	// Load the file - File constructor starts loading immediately
	var file = new File(fileUrl, function(loadedFile, caller) {
		enyo.log("File loaded, ready=" + loadedFile.ready + ", failure=" + loadedFile.failure);

		if (loadedFile.failure || !loadedFile.ready) {
			callback(null, "Failed to read file: " + filePath);
			return;
		}

		ImportStats.phase("load");
		ping("Reading file..."); // file loaded - reset watchdog
		enyo.log("File loaded, size: " + loadedFile.getLength() + " bytes");

		// Create a ZipFile from the File (File is a ByteReader)
		var zipFile;
		try {
			zipFile = new ZipFile(loadedFile);
			if (zipFile.error !== 0) {
				callback(null, "Failed to parse ZIP archive, error code: " + zipFile.error);
				return;
			}
		} catch (e) {
			callback(null, "Failed to open ePub archive: " + (e.message || e));
			return;
		}

		enyo.log("ZipFile created, loading EpubReader...");

		// Create the EpubReader to parse the ePub
		new EpubReader(zipFile, function(zip, reader) {
			enyo.log("EpubReader callback, reader=" + (reader ? "valid" : "null"));

			if (reader == null) {
				callback(null, "Failed to parse ePub. The file may be corrupted, invalid, or DRM protected.");
				return;
			}

			ImportStats.phase("parse");
			ping("Parsing ePub..."); // epub parsed - reset watchdog

			// Size up the book before the expensive storage pass.
			var pf = self.preflight(reader);
			enyo.warn("PREFLIGHT chapters=" + pf.chapters + " textKB=" + Math.round(pf.textBytes / 1024) +
				" images=" + pf.images + " imageKB=" + Math.round(pf.imageBytes / 1024) +
				" bigImages=" + pf.bigImages + " dataUri=" + pf.dataUri);
			ImportStats.count("textKB", Math.round(pf.textBytes / 1024));
			ImportStats.count("images", pf.images);
			// Honest ETA in the progress text. MUST keep the "Processing" prefix:
			// Main.js keepAlive() substring-matches it to detect the content phase.
			var eta = self.describePreflight(pf);
			var etaSuffix = eta ? (" (" + eta + ")...") : "...";
			if (pf.dataUri && window.PalmSystem) {
				// Honest notice rather than a silent partial import; the engine
				// can truncate on a tag larger than one chunk (audit F8).
				enyo.warn("PREFLIGHT: book contains inline data: URIs - import may be slow or incomplete");
			}

			// Extract metadata
			var metadata = reader.getMetadata() || {};
			var bookName = metadata.title || reader.getName() || File.extractBasename(filePath);

			enyo.log("Book metadata: title=" + metadata.title + ", author=" + metadata.author);

			// Extract raw cover data URL, then scale to a 120x180 thumbnail via
			// canvas before storing.  The raw data URL (potentially several MB)
			// is only held transiently; only the small thumbnail is persisted.
			var rawCoverDataUrl = null;
			try {
				rawCoverDataUrl = reader.getCoverImage();
			} catch (e) {
				enyo.warn("Error extracting cover: " + e);
			}

			// Generate a unique database name (needed by both paths below)
			var dbName = "ereader_" + self.generateUniqueId(filePath);

			var continueWithCover = function(coverImageData) {
				ImportStats.phase("cover");
				// Free the database a previous import of this same file left
				// behind before writing a new one, so re-imports stop stranding
				// full copies of the book's content (audit F6).
				self.purgePreviousDb(filePath, dbName, function() {
					continueAfterPurge(coverImageData);
				});
			};

			var continueAfterPurge = function(coverImageData) {
				// Startup heartbeat: keep the UI alive briefly while WebSQL opens, then
				// let the real HTMLBook chunk progress take over. If chunk progress never
				// starts, the watchdog should time out instead of spinning forever.
				var htmlBookStarted = false;
				var htmlBookHeartbeatTicks = 0;
				var htmlBookHeartbeat = setInterval(function() {
					if (htmlBookStarted || htmlBookHeartbeatTicks++ >= 6) {
						clearInterval(htmlBookHeartbeat);
						return;
					}
					ping("Preparing database...");
				}, 5000);

				var htmlBookProgress = function(phase) {
					htmlBookStarted = true;
					clearInterval(htmlBookHeartbeat);
					ping(phase);
				};

				// Create the HTMLBook for storage
				enyo.log("Creating HTMLBook with dbName: " + dbName);
				var htmlBook = new HTMLBook(reader, false, dbName, function(book) {
					clearInterval(htmlBookHeartbeat);
					enyo.log("HTMLBook callback, book=" + (book ? "valid" : "null") + ", isReady=" + (book ? book.isReady : "N/A"));

					// A cancelled/failed import must not add itself to the library
					// later, which is how "timed out" books used to reappear as
					// phantom entries on next launch (audit F5).
					if (session.cancelled) { return; }

					if (!book || !book.isReady) {
						callback(null, "Failed to process ePub content");
						return;
					}

					ImportStats.phase("store");

					// Create BookData from the imported content
					var bookData = new BookData({
						asin: self.generateUniqueId(filePath),
						title: metadata.title || bookName,
						author: metadata.author || "",
						publisher: metadata.publisher || "",
						language: metadata.language || "",
						bookFilePath: filePath,
						bookDbName: dbName,
						coverImagePath: coverImageData || "",  // Store thumbnail data URL
						locationsCompleted: 0,
						locationsTotal: 10000,  // Fixed scale 0-10000 for percentage positions
						bookByteLength: book.getLength() || 0,
						dateAdded: Date.now(),
						lastAccessed: Date.now()
					});

					// Store metadata for quick access
					self.saveBookMetadata(bookData);
					self.registerDb(dbName, bookData.asin);

					enyo.log("Book imported successfully: " + bookData.title);
					callback(bookData, null);
				}, htmlBookProgress);  // pass chunk progress through to the UI/watchdog
			};

			if (rawCoverDataUrl) {
				ping("Scaling cover...");
				self.scaleCoverToThumbnail(rawCoverDataUrl, 120, 180, function(thumbnail) {
					ping("Processing content" + etaSuffix);
					continueWithCover(thumbnail);
				});
			} else {
				ping("Processing content" + etaSuffix);
				continueWithCover(null);
			}
		}, null);
	}, self);
};

/**
 * Shared pipeline: ArrayBuffer → ZipFile → EpubReader → HTMLBook → BookData.
 * Called by both _importEpubFromBrowserFile (after FileReader) and
 * importEpubFromUrl (after XHR). filePath is stored on the BookData record
 * and used as the dedup key in saveBookMetadata — pass the original file name
 * (for user imports) or the relative URL (for sample books) so re-imports
 * don't create duplicates.
 */
FileImporter.prototype._processEpubArrayBuffer = function(arrayBuffer, filename, filePath, callback, ping) {
	var self = this;

	// Callers (_importEpubFromBrowserFile / importEpubFromUrl) have already
	// called ImportSession.begin + ImportStats.begin and done the file read,
	// so close out "load" here and route every exit through the same choke
	// point importEpub uses.
	ImportStats.phase("load");
	var session = this.session || ImportSession.current;
	var rawCallback = callback;
	var finished = false;
	callback = function(book, error) {
		if (finished) { return; }
		finished = true;
		if (session && ImportSession.current === session) { ImportSession.endCurrent(); }
		ImportStats.end(error ? ((session && session.cancelled) ? "cancelled" : "error") : "ok");
		rawCallback(book, error);
	};
	if (session) {
		session.onFail = function(reason) { callback(null, reason); };
	}

	var byteReader = new ArrayBufferByteReader(arrayBuffer);
	byteReader._name = filename;

	var zipFile;
	try {
		zipFile = new ZipFile(byteReader);
		if (zipFile.error !== 0) {
			callback(null, 'Failed to parse ZIP archive, error code: ' + zipFile.error);
			return;
		}
	} catch (ex) {
		callback(null, 'Failed to open ePub archive: ' + (ex.message || ex));
		return;
	}

	ping('Parsing ePub...');

	new EpubReader(zipFile, function(zip, epubReader) {
		if (epubReader == null) {
			callback(null, 'Failed to parse ePub. The file may be corrupted, invalid, or DRM protected.');
			return;
		}

		ImportStats.phase("parse");

		var pf = self.preflight(epubReader);
		enyo.warn("PREFLIGHT chapters=" + pf.chapters + " textKB=" + Math.round(pf.textBytes / 1024) +
			" images=" + pf.images + " imageKB=" + Math.round(pf.imageBytes / 1024) +
			" bigImages=" + pf.bigImages + " dataUri=" + pf.dataUri);
		ImportStats.count("textKB", Math.round(pf.textBytes / 1024));
		ImportStats.count("images", pf.images);
		var eta = self.describePreflight(pf);
		var etaSuffix = eta ? (" (" + eta + ")...") : "...";

		var metadata = epubReader.getMetadata() || {};
		var bookName = metadata.title || epubReader.getName() || filename.replace(/\.epub$/i, '');

		enyo.log('Book metadata: title=' + metadata.title + ', author=' + metadata.author);

		var rawCoverDataUrl = null;
		try {
			rawCoverDataUrl = epubReader.getCoverImage();
		} catch (ex) {
			enyo.warn('Error extracting cover: ' + ex);
		}

		var dbName = 'ereader_' + self.generateUniqueId(filePath);

		var continueWithCover = function(coverImageData) {
			ImportStats.phase("cover");
			self.purgePreviousDb(filePath, dbName, function() {
				continueAfterPurge(coverImageData);
			});
		};

		var continueAfterPurge = function(coverImageData) {
			var htmlBookStarted = false;
			var htmlBookHeartbeatTicks = 0;
			var htmlBookHeartbeat = setInterval(function() {
				if (htmlBookStarted || htmlBookHeartbeatTicks++ >= 6) {
					clearInterval(htmlBookHeartbeat);
					return;
				}
				ping('Preparing database...');
			}, 5000);

			var htmlBookProgress = function(phase) {
				htmlBookStarted = true;
				clearInterval(htmlBookHeartbeat);
				ping(phase);
			};

			new HTMLBook(epubReader, false, dbName, function(book) {
				clearInterval(htmlBookHeartbeat);
				if (session && session.cancelled) { return; }
				if (!book || !book.isReady) {
					callback(null, 'Failed to process ePub content');
					return;
				}

				ImportStats.phase("store");

				var bookData = new BookData({
					asin: self.generateUniqueId(filePath),
					title: metadata.title || bookName,
					author: metadata.author || '',
					publisher: metadata.publisher || '',
					language: metadata.language || '',
					bookFilePath: filePath,
					bookDbName: dbName,
					coverImagePath: coverImageData || '',
					locationsCompleted: 0,
					locationsTotal: 10000,
					bookByteLength: book.getLength() || 0,
					dateAdded: Date.now(),
					lastAccessed: Date.now()
				});

				self.saveBookMetadata(bookData);
				self.registerDb(dbName, bookData.asin);
				enyo.log('Book imported successfully: ' + bookData.title);
				callback(bookData, null);
			}, htmlBookProgress);
		};

		if (rawCoverDataUrl) {
			ping('Scaling cover...');
			self.scaleCoverToThumbnail(rawCoverDataUrl, 120, 180, function(thumbnail) {
				ping('Processing content' + etaSuffix);
				continueWithCover(thumbnail);
			});
		} else {
			ping('Processing content' + etaSuffix);
			continueWithCover(null);
		}
	}, null);
};

/**
 * Import an ePub from a browser File object (FileReader API path).
 * Called by importEpub when it receives a File object instead of a path string.
 * ZipFile and EpubReader are unchanged — ArrayBufferByteReader bridges the gap.
 */
FileImporter.prototype._importEpubFromBrowserFile = function(file, callback, ping) {
	var self = this;
	var filename = (file && file.name) ? file.name : 'unknown.epub';

	enyo.log("FileImporter._importEpubFromBrowserFile: " + filename);

	if (filename.toLowerCase().indexOf('.epub') === -1) {
		callback(null, 'File is not an ePub');
		return;
	}

	var bfSession = ImportSession.begin();
	if (!bfSession) {
		callback(null, 'An import is already running.');
		return;
	}
	this.session = bfSession;
	ImportStats.begin(filename);
	ping('Reading file...');

	var fileReader = new FileReader();
	fileReader.onload = function(e) {
		self._processEpubArrayBuffer(e.target.result, filename, filename, callback, ping);
	};
	fileReader.onerror = function() {
		if (ImportSession.current === bfSession) { ImportSession.endCurrent(); }
		ImportStats.end("error");
		callback(null, 'Failed to read file: ' + filename);
	};
	fileReader.readAsArrayBuffer(file);
};

/**
 * Import an ePub from a URL (relative or absolute).
 * Uses XHR with responseType='arraybuffer' — works on both modern browsers
 * and webOS 3 (WebKit 534, which supports ArrayBuffer responseType).
 * The url is used as the bookFilePath dedup key so re-fetching the same
 * sample URL never creates a duplicate library entry.
 */
FileImporter.prototype.importEpubFromUrl = function(url, filename, callback, ping) {
	var self = this;
	ping = ping || function() {};

	enyo.log('FileImporter.importEpubFromUrl: ' + url);

	// On webOS, Uint8Array is not defined (WebKit 534 shipped ArrayBuffer
	// support for XHR but never implemented the TypedArray constructors).
	// Route through importEpub() instead, which uses the native pReader
	// File class that operates directly on the webOS filesystem.
	// Resolve the relative URL against the document location to get an
	// absolute path (e.g. /media/cryptofs/.../sample-books/Alice.epub).
	if (window.PalmSystem) {
		var base = window.location.href.replace(/\/[^\/]*$/, '/'); // dir of index.html
		var filePath = (base + url).replace(/^file:\/\//, '');
		self.importEpub(filePath, callback, ping);
		return;
	}

	var urlSession = ImportSession.begin();
	if (!urlSession) {
		callback(null, 'An import is already running.');
		return;
	}
	self.session = urlSession;
	ImportStats.begin(filename);
	ping('Fetching ' + filename + '...');

	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = 'arraybuffer';

	xhr.onload = function() {
		if (xhr.status < 200 || xhr.status >= 400) {
			if (ImportSession.current === urlSession) { ImportSession.endCurrent(); }
			ImportStats.end("error");
			callback(null, 'HTTP ' + xhr.status + ' fetching ' + filename);
			return;
		}
		ping('Reading file...');
		self._processEpubArrayBuffer(xhr.response, filename, url, callback, ping);
	};

	xhr.onerror = function() {
		if (ImportSession.current === urlSession) { ImportSession.endCurrent(); }
		ImportStats.end("error");
		callback(null, 'Network error fetching ' + filename);
	};

	xhr.send(null);
};

/**
 * Sample books bundled with the app — installed on first launch so new users
 * never start with an empty library.  Users can delete these books normally;
 * the flag ensures they are never re-installed after deletion.
 */
FileImporter.SAMPLE_BOOKS = [
	{ url: 'sample-books/AliceInWonderland-Carroll.epub',   filename: 'AliceInWonderland-Carroll.epub'   },
	{ url: 'sample-books/HoundOfBaskervilles-Doyle.epub',   filename: 'HoundOfBaskervilles-Doyle.epub'   }
];

/**
 * Install sample books on demand (triggered by "Add Sample Books" menu item).
 *
 * Imports each sample book via importEpubFromUrl, calling
 * progressCallback(current, total) for each.  Duplicate detection is handled
 * by importEpubFromUrl (same URL is never added twice), so this is safe to
 * call multiple times.  Errors on individual books are logged and skipped.
 */
FileImporter.prototype.installSampleBooks = function(progressCallback, completeCallback) {
	var self = this;
	var samples = FileImporter.SAMPLE_BOOKS;
	var index = 0;

	function importNext() {
		if (index >= samples.length) {
			completeCallback();
			return;
		}

		var sample = samples[index];
		index++;

		if (progressCallback) progressCallback(index, samples.length);

		self.importEpubFromUrl(sample.url, sample.filename, function(book, error) {
			if (error) {
				enyo.warn('Sample book install failed (' + sample.filename + '): ' + error);
			} else {
				enyo.log('Sample book installed: ' + (book ? book.title : sample.filename));
			}
			importNext();
		}, function() {});
	}

	importNext();
};

/**
 * Scale a cover image data URL to a small thumbnail using canvas.
 *
 * The raw cover from EpubReader can be several MB.  Rather than storing that
 * in localStorage we draw it into a 120x180 canvas and store only the
 * resulting JPEG thumbnail (~15KB).  This works for any cover size and avoids
 * O(n^2) string-building during storage.
 *
 * @param {String}   dataUrl  - Full-resolution "data:image/...;base64,..." string
 * @param {Number}   width    - Target thumbnail width in px
 * @param {Number}   height   - Target thumbnail height in px
 * @param {Function} callback - Called with thumbnail data URL, or null on failure
 */
FileImporter.prototype.scaleCoverToThumbnail = function(dataUrl, width, height, callback) {
	var img = new Image();

	img.onload = function() {
		try {
			var canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			var ctx = canvas.getContext("2d");

			// Scale cover to fill the target rect, cropping to center (no letterboxing).
			// Math.max ensures the image covers the full canvas in both dimensions;
			// the excess is clipped. This prevents white bars on covers that are not
			// exactly 2:3, which would make the frame appear wider than the cover art.
			var scale = Math.max(width / img.width, height / img.height);
			var drawW = Math.round(img.width * scale);
			var drawH = Math.round(img.height * scale);
			var drawX = Math.round((width - drawW) / 2);
			var drawY = Math.round((height - drawH) / 2);
			ctx.drawImage(img, drawX, drawY, drawW, drawH);

			var thumbnail = canvas.toDataURL("image/jpeg", 0.75);
			enyo.log("Cover thumbnail: " + thumbnail.length + " bytes (was " + dataUrl.length + ")");
			callback(thumbnail);
		} catch (e) {
			enyo.warn("Canvas cover scaling failed: " + e);
			callback(null);
		}
	};

	img.onerror = function() {
		enyo.warn("Cover image failed to load for scaling");
		callback(null);
	};

	img.src = dataUrl;
};

/**
 * Generate a unique ID from a file path
 */
FileImporter.prototype.generateUniqueId = function(filePath) {
	// Simple hash function for generating unique IDs
	var hash = 0;
	for (var i = 0; i < filePath.length; i++) {
		var char = filePath.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return "epub_" + Math.abs(hash).toString(16) + "_" + Date.now().toString(16);
};

/**
 * Sizes up a parsed book before the expensive storage pass begins.
 *
 * Everything here is already in memory once EpubReader has finished, so this
 * is nearly free.  It gives us an honest progress estimate and lets us warn
 * about the two structures this engine is known to handle badly: very large
 * inline data: URIs (which can trigger a quadratic re-parse, audit F7, or
 * silent truncation, audit F8) and oversized images.
 *
 * @param {EpubReader} reader a reader that has finished parsing
 * @return {Object} {chapters, textBytes, images, imageBytes, bigImages, dataUri}
 */
FileImporter.prototype.preflight = function(reader) {
	var out = { chapters: 0, textBytes: 0, images: 0, imageBytes: 0, bigImages: 0, dataUri: false };
	var rf = (reader && reader.structure && reader.structure.rfData[0]) || null;
	if (!rf) { return out; }

	var i, j, d;
	out.chapters = rf.chapters.length;
	for (i = 0; i < rf.chapters.length; i++) {
		d = rf.chapters[i].data;
		if (!d) { continue; }
		out.textBytes += d.length;
		// Byte-scan for "data:" (64 61 74 61 3A). A data: URI inside an
		// attribute survives filtering verbatim and can exceed a whole chunk.
		if (!out.dataUri) {
			for (j = 0; j + 4 < d.length; j++) {
				if (d[j] === 0x64 && d[j + 1] === 0x61 && d[j + 2] === 0x74 &&
						d[j + 3] === 0x61 && d[j + 4] === 0x3A) {
					out.dataUri = true;
					break;
				}
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

/**
 * Bytes of book text this engine stores per second, used only to turn the
 * pre-flight size into a rough ETA for the progress dialog.  Deliberately
 * conservative; calibrated against a TouchPad importing a ~470KB novel in
 * ~90 seconds.  Wrong estimates are harmless - this drives text, not logic.
 */
FileImporter.STORE_BYTES_PER_SEC = 5200;

/**
 * Renders a pre-flight into a short human estimate, or "" when it would be
 * too small to be worth showing.
 */
FileImporter.prototype.describePreflight = function(pf) {
	var secs = Math.round(pf.textBytes / FileImporter.STORE_BYTES_PER_SEC);
	if (secs < 20) { return ""; }
	if (secs < 90) { return "about a minute"; }
	return "about " + Math.round(secs / 60) + " minutes";
};

/**
 * Key under which every book database this app has ever created is recorded.
 * WebSQL offers no way to enumerate databases, so without our own registry an
 * abandoned database is unreachable from JS forever (audit F6).
 */
FileImporter.DB_REGISTRY_KEY = "ereader_dbs";
FileImporter.DB_REGISTRY_MAX = 200;

/**
 * Records a database name so it can be swept later if it is ever orphaned.
 */
FileImporter.prototype.registerDb = function(dbName, asin) {
	try {
		var reg = JSON.parse(localStorage.getItem(FileImporter.DB_REGISTRY_KEY) || "[]");
		for (var i = 0; i < reg.length; i++) {
			if (reg[i].db === dbName) { return; }
		}
		reg.push({ db: dbName, asin: asin || "", t: Date.now() });
		while (reg.length > FileImporter.DB_REGISTRY_MAX) { reg.shift(); }
		localStorage.setItem(FileImporter.DB_REGISTRY_KEY, JSON.stringify(reg));
	} catch (e) {
		enyo.warn("registerDb failed: " + e);
	}
};

/**
 * Finds the database a previous import of this same file left behind.
 *
 * dbName embeds Date.now(), so re-importing a book always produces a NEW
 * database while saveBookMetadata replaces the library entry that pointed at
 * the old one - stranding a full copy of the book's content forever.  A device
 * check found 30 databases / 107MB with three copies of a single book.
 */
FileImporter.prototype.findPreviousDbName = function(filePath, newDbName) {
	try {
		var lib = JSON.parse(localStorage.getItem("ereader_library") || "[]");
		for (var i = 0; i < lib.length; i++) {
			if (lib[i].bookFilePath === filePath &&
					lib[i].bookDbName && lib[i].bookDbName !== newDbName) {
				return lib[i].bookDbName;
			}
		}
	} catch (e) {
		enyo.warn("findPreviousDbName failed: " + e);
	}
	return null;
};

/**
 * Purges the database left by a previous import of this file, then continues.
 * Always calls done(), whether or not there was anything to purge.
 */
FileImporter.prototype.purgePreviousDb = function(filePath, newDbName, done) {
	var old = this.findPreviousDbName(filePath, newDbName);
	if (!old) { done(); return; }
	enyo.warn("Purging database replaced by re-import: " + old);
	try {
		HTMLBook.deleteBook(old, function() { done(); });
	} catch (e) {
		enyo.warn("purgePreviousDb failed: " + e);
		done();
	}
};

/**
 * Deletes registered databases that no library book points at any more.
 *
 * Runs once, a little after launch, so a book whose import was killed midway
 * (app swiped away, device rebooted) does not leave its partial database on
 * disk permanently.  Entries younger than minAgeMs are left alone so this can
 * never race an import that is still running.
 */
FileImporter.prototype.sweepOrphanDbs = function(minAgeMs, done) {
	done = done || function() {};
	var reg, lib;
	try {
		reg = JSON.parse(localStorage.getItem(FileImporter.DB_REGISTRY_KEY) || "[]");
		lib = JSON.parse(localStorage.getItem("ereader_library") || "[]");
	} catch (e) {
		done(0);
		return;
	}
	if (!reg.length) { done(0); return; }

	var inUse = {};
	for (var i = 0; i < lib.length; i++) {
		if (lib[i].bookDbName) { inUse[lib[i].bookDbName] = true; }
	}
	var cutoff = Date.now() - (minAgeMs || 86400000);
	var orphans = [], keep = [];
	for (var j = 0; j < reg.length; j++) {
		if (!inUse[reg[j].db] && reg[j].t < cutoff) { orphans.push(reg[j].db); }
		else { keep.push(reg[j]); }
	}
	if (!orphans.length) { done(0); return; }

	// This is the only destructive background behaviour in the app, so name
	// every database before touching it. If it ever removes something it
	// should not have, the log says exactly what went and what the library
	// looked like at the time - otherwise the evidence is gone with the data.
	enyo.warn("DB sweep: " + orphans.length + " orphan(s) of " + reg.length +
		" registered, library holds " + lib.length + " book(s): " + orphans.join(", "));

	// Delete one at a time; parallel WebSQL teardown on webOS is asking for trouble.
	var idx = 0;
	var next = function() {
		if (idx >= orphans.length) {
			try {
				localStorage.setItem(FileImporter.DB_REGISTRY_KEY, JSON.stringify(keep));
			} catch (e2) {}
			enyo.warn("DB sweep: purged " + orphans.length + " orphan database(s)");
			done(orphans.length);
			return;
		}
		var name = orphans[idx++];
		enyo.warn("DB sweep: purging " + name);
		try {
			HTMLBook.deleteBook(name, function() { next(); });
		} catch (e3) {
			enyo.warn("DB sweep: failed to purge " + name + ": " + e3);
			next();
		}
	};
	next();
};

/**
 * Save book metadata to localStorage
 */
FileImporter.prototype.saveBookMetadata = function(bookData) {
	try {
		// Get existing library
		var libraryJson = localStorage.getItem("ereader_library");
		var library = libraryJson ? JSON.parse(libraryJson) : [];

		// Check if book already exists (by file path)
		var existingIndex = -1;
		for (var i = 0; i < library.length; i++) {
			if (library[i].bookFilePath === bookData.bookFilePath) {
				existingIndex = i;
				break;
			}
		}

		// Update or add
		if (existingIndex >= 0) {
			library[existingIndex] = bookData.toJSON();
		} else {
			library.push(bookData.toJSON());
		}

		// Save back
		localStorage.setItem("ereader_library", JSON.stringify(library));
	} catch (e) {
		console.error("Failed to save book metadata: " + e);
	}
};

/**
 * Scan a directory for ePub files
 * @param {String} dirPath - Directory path to scan
 * @param {Function} callback - Called with array of file paths
 */
FileImporter.prototype.scanDirectory = function(dirPath, callback) {
	var self = this;
	console.log("Scanning directory: " + dirPath);

	// On webOS, we need to use the file manager service
	if (window.PalmSystem && typeof PalmServiceBridge !== "undefined") {
		var bridge = new PalmServiceBridge();
		bridge.onservicecallback = function(response) {
			try {
				var result = JSON.parse(response);
				var epubFiles = [];
				if (result.files) {
					for (var i = 0; i < result.files.length; i++) {
						var file = result.files[i];
						var name = file.name || file;
						if (typeof name === "string" && name.toLowerCase().indexOf(".epub") !== -1) {
							epubFiles.push(dirPath + "/" + name);
						}
					}
				}
				callback(epubFiles);
			} catch (e) {
				console.warn("Error parsing directory response: " + e);
				callback([]);
			}
		};

		try {
			bridge.call("palm://com.palm.filenotify/listFiles", JSON.stringify({
				path: dirPath
			}));
		} catch (e) {
			console.warn("PalmServiceBridge call failed: " + e);
			callback([]);
		}
	} else {
		// For testing, try to check if known files exist
		console.log("No PalmServiceBridge, using fallback");
		callback([]);
	}
};

/**
 * Check if a file exists by trying to load its first few bytes
 * @param {String} filePath - Path to check
 * @param {Function} callback - Called with boolean
 */
FileImporter.prototype.fileExists = function(filePath, callback) {
	var xhr = new XMLHttpRequest();
	xhr.open("HEAD", "file://" + filePath, true);
	xhr.onreadystatechange = function() {
		if (xhr.readyState === 4) {
			callback(xhr.status >= 200 && xhr.status < 400);
		}
	};
	xhr.onerror = function() {
		callback(false);
	};
	try {
		xhr.send(null);
	} catch (e) {
		callback(false);
	}
};

/**
 * Delete a book from the library
 * @param {BookData} bookData - The book to delete
 * @param {Function} callback - Called when done
 */
FileImporter.prototype.deleteBook = function(bookData, callback) {
	try {
		// Remove from localStorage
		var libraryJson = localStorage.getItem("ereader_library");
		var library = libraryJson ? JSON.parse(libraryJson) : [];

		library = library.filter(function(book) {
			return book.asin !== bookData.asin;
		});

		localStorage.setItem("ereader_library", JSON.stringify(library));

		// Delete the HTMLBook database
		if (bookData.bookDbName) {
			HTMLBook.deleteBook(bookData.bookDbName, function() {
				if (callback) callback(null);
			});
		} else {
			if (callback) callback(null);
		}
	} catch (e) {
		if (callback) callback(e.message);
	}
};

/**
 * Get all books from the library
 * @param {Function} callback - Called with array of BookData
 */
FileImporter.prototype.getLibrary = function(callback) {
	try {
		var libraryJson = localStorage.getItem("ereader_library");
		var library = libraryJson ? JSON.parse(libraryJson) : [];

		var books = library.map(function(bookJson) {
			return new BookData(bookJson);
		});

		callback(books);
	} catch (e) {
		callback([]);
	}
};

/**
 * Import books from the default ePub directory
 * @param {Function} progressCallback - Called with (current, total) during import
 * @param {Function} completeCallback - Called when all imports are done
 */
FileImporter.prototype.importFromDefaultDirectory = function(progressCallback, completeCallback) {
	var self = this;
	var defaultPaths = [
		"/media/internal/ebooks",
		"/media/internal/books",
		"/media/internal/Documents",
		"/media/internal/downloads"
	];

	var allFiles = [];
	var pathsScanned = 0;

	// Scan each default path
	defaultPaths.forEach(function(path) {
		self.scanDirectory(path, function(files) {
			allFiles = allFiles.concat(files);
			pathsScanned++;

			if (pathsScanned === defaultPaths.length) {
				// Import all found files
				self.importMultiple(allFiles, progressCallback, completeCallback);
			}
		});
	});
};

/**
 * Import multiple ePub files
 * @param {Array} filePaths - Array of file paths
 * @param {Function} progressCallback - Called with (current, total)
 * @param {Function} completeCallback - Called when all imports are done
 */
FileImporter.prototype.importMultiple = function(filePaths, progressCallback, completeCallback) {
	var self = this;
	var imported = 0;
	var total = filePaths.length;
	var results = [];

	if (total === 0) {
		completeCallback(results);
		return;
	}

	var importNext = function(index) {
		if (index >= total) {
			completeCallback(results);
			return;
		}

		self.importEpub(filePaths[index], function(bookData, error) {
			imported++;
			if (progressCallback) {
				progressCallback(imported, total);
			}

			if (bookData) {
				results.push(bookData);
			}

			// Continue with next file
			importNext(index + 1);
		});
	};

	importNext(0);
};
