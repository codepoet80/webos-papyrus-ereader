/**
 * FileImporter - ePub file import handler
 *
 * Handles importing ePub files into the library. Uses Preader's EpubReader
 * for parsing and HTMLBook for storage.
 */
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
	// keepAlive() is called at each major milestone so the caller can reset
	// a progress-based watchdog timer.  It is optional.
	var ping = keepAlive || function() {};

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

			ping("Parsing ePub..."); // epub parsed - reset watchdog

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

					if (!book || !book.isReady) {
						callback(null, "Failed to process ePub content");
						return;
					}

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

					enyo.log("Book imported successfully: " + bookData.title);
					callback(bookData, null);
				}, htmlBookProgress);  // pass chunk progress through to the UI/watchdog
			};

			if (rawCoverDataUrl) {
				ping("Scaling cover...");
				self.scaleCoverToThumbnail(rawCoverDataUrl, 120, 180, function(thumbnail) {
					ping("Processing content...");
					continueWithCover(thumbnail);
				});
			} else {
				ping("Processing content...");
				continueWithCover(null);
			}
		}, null);
	}, self);
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
