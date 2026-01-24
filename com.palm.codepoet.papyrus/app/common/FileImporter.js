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
FileImporter.prototype.importEpub = function(filePath, callback) {
	var self = this;

	console.log("FileImporter.importEpub: " + filePath);

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

	console.log("Loading file URL: " + fileUrl);

	// Load the file - File constructor starts loading immediately
	var file = new File(fileUrl, function(loadedFile, caller) {
		console.log("File loaded, ready=" + loadedFile.ready + ", failure=" + loadedFile.failure);

		if (loadedFile.failure || !loadedFile.ready) {
			callback(null, "Failed to read file: " + filePath);
			return;
		}

		console.log("File loaded, size: " + loadedFile.getLength() + " bytes");

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

		console.log("ZipFile created, loading EpubReader...");

		// Create the EpubReader to parse the ePub
		new EpubReader(zipFile, function(zip, reader) {
			console.log("EpubReader callback, reader=" + (reader ? "valid" : "null"));

			if (reader == null) {
				callback(null, "Failed to parse ePub. The file may be corrupted, invalid, or DRM protected.");
				return;
			}

			// Extract metadata
			var metadata = reader.getMetadata() || {};
			var bookName = metadata.title || reader.getName() || File.extractBasename(filePath);

			console.log("Book metadata: title=" + metadata.title + ", author=" + metadata.author);

			// Extract cover image
			var coverImageData = null;
			try {
				coverImageData = reader.getCoverImage();
				if (coverImageData) {
					console.log("Cover image extracted, length=" + coverImageData.length);
				} else {
					console.log("No cover image found");
				}
			} catch (e) {
				console.log("Error extracting cover: " + e);
			}

			// Generate a unique database name
			var dbName = "ereader_" + self.generateUniqueId(filePath);

			// Create the HTMLBook for storage
			console.log("Creating HTMLBook with dbName: " + dbName);
			var htmlBook = new HTMLBook(reader, false, dbName, function(book) {
				console.log("HTMLBook callback, book=" + (book ? "valid" : "null") + ", isReady=" + (book ? book.isReady : "N/A"));

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
					coverImagePath: coverImageData || "",  // Store cover as data URL
					locationsCompleted: 0,
					locationsTotal: 10000,  // Fixed scale 0-10000 for percentage positions
					bookByteLength: book.getLength() || 0,  // Store actual byte length separately
					dateAdded: Date.now(),
					lastAccessed: Date.now()
				});

				// Store metadata for quick access
				self.saveBookMetadata(bookData);

				console.log("Book imported successfully: " + bookData.title);
				callback(bookData, null);
			});
		}, null);
	}, self);
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
