/**
 * BookData - Data model for ePub books
 *
 * Simplified version that removes Amazon-specific fields and adds ePub metadata.
 */
function BookData(options) {
	options = options || {};

	// Unique identifier (hash of file path or generated UUID)
	this.asin = options.asin || options.uid || Math.uuid();

	// Basic metadata
	this.title = options.title || "Unknown Title";
	this.author = options.author || "Unknown Author";
	this.publisher = options.publisher || "";
	this.language = options.language || "";

	// File paths
	this.bookFilePath = options.bookFilePath || "";
	this.coverImagePath = options.coverImagePath || "";
	this.bookDbName = options.bookDbName || "";  // Database name for HTMLBook

	// Reading state
	this.locationsCompleted = options.locationsCompleted || 0;  // Current reading position (0-10000 scale)
	this.locationsTotal = options.locationsTotal || 10000;      // Total positions (always 10000 for percentage)
	this.lastAccessed = options.lastAccessed || Date.now();

	// Organization
	this.categories = options.categories || [];

	// Annotation counts
	this.numMarkups = options.numMarkups || 0;
	this.numBookmarks = options.numBookmarks || 0;
	this.numNotes = options.numNotes || 0;
	this.numHighlights = options.numHighlights || 0;

	// Indexing fields for sorting
	this.titleIndex = this.computeTitleIndex(this.title);
	this.authorIndex = this.computeAuthorIndex(this.author);

	// File info
	this.fileSize = options.fileSize || 0;
	this.dateAdded = options.dateAdded || Date.now();
}

/**
 * Compute title index (removes leading articles for sorting)
 */
BookData.prototype.computeTitleIndex = function(title) {
	if (!title) return "";

	// Remove leading articles
	var articles = ["the ", "a ", "an ", "der ", "die ", "das ", "le ", "la ", "les ", "el ", "los ", "las "];
	var lowerTitle = title.toLowerCase();

	for (var i = 0; i < articles.length; i++) {
		if (lowerTitle.indexOf(articles[i]) === 0) {
			return title.substring(articles[i].length);
		}
	}

	return title;
};

/**
 * Compute author index (last name for sorting)
 */
BookData.prototype.computeAuthorIndex = function(author) {
	if (!author) return "";

	// Try to extract last name
	var parts = author.trim().split(/\s+/);
	if (parts.length > 1) {
		return parts[parts.length - 1];
	}

	return author;
};

/**
 * Get reading progress as percentage (0-100)
 */
BookData.prototype.getReadingProgress = function() {
	if (this.locationsTotal <= 0) return 0;
	return Math.floor((this.locationsCompleted / this.locationsTotal) * 100);
};

/**
 * Convert to a plain object for storage
 */
BookData.prototype.toJSON = function() {
	return {
		asin: this.asin,
		title: this.title,
		author: this.author,
		publisher: this.publisher,
		language: this.language,
		bookFilePath: this.bookFilePath,
		coverImagePath: this.coverImagePath,
		bookDbName: this.bookDbName,
		locationsCompleted: this.locationsCompleted,
		locationsTotal: this.locationsTotal,
		lastAccessed: this.lastAccessed,
		categories: this.categories,
		numMarkups: this.numMarkups,
		numBookmarks: this.numBookmarks,
		numNotes: this.numNotes,
		numHighlights: this.numHighlights,
		titleIndex: this.titleIndex,
		authorIndex: this.authorIndex,
		fileSize: this.fileSize,
		dateAdded: this.dateAdded
	};
};

/**
 * Create BookData from a Preader LibraryEntry
 */
BookData.fromLibraryEntry = function(entry) {
	return new BookData({
		asin: entry.uid,
		title: entry.title || entry.name,
		author: entry.author || "",
		publisher: entry.publisher || "",
		language: entry.language || "",
		bookFilePath: entry.bookDbName ? ("internal://" + entry.bookDbName) : "",
		bookDbName: entry.bookDbName,
		locationsCompleted: entry.currReadingPos ? Math.floor((entry.currReadingPos / entry.length) * 10000) : 0,
		locationsTotal: 10000,
		categories: entry.category ? [entry.category] : [],
		numBookmarks: entry.bookmarks ? entry.bookmarks.length : 0
	});
};

/**
 * Create BookData from EpubReader metadata
 */
BookData.fromEpubReader = function(epubReader, filePath) {
	var metadata = epubReader.getMetadata() || {};

	return new BookData({
		asin: Math.uuid(),
		title: metadata.title || epubReader.getName() || File.extractBasename(filePath),
		author: metadata.author || "",
		publisher: metadata.publisher || "",
		language: metadata.language || "",
		bookFilePath: filePath,
		bookDbName: "ereader_" + File.extractBasename(filePath),
		locationsCompleted: 0,
		locationsTotal: 10000
	});
};
