/**
 * ES5 polyfills for webOS 3.0's JavaScript engine.
 * Must load before all other src/ files.
 */

// String.prototype.startsWith (ES6) - used throughout the pReader engine
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
        position = position || 0;
        return this.indexOf(searchString, position) === position;
    };
}

// String.prototype.endsWith (ES6)
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(searchString, length) {
        var len = (length !== undefined && length < this.length) ? length : this.length;
        var start = len - searchString.length;
        if (start < 0) return false;
        return this.indexOf(searchString, start) === start;
    };
}

// Array.prototype.find (ES6) - used in ContentNavigator
if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
        for (var i = 0; i < this.length; i++) {
            if (predicate(this[i], i, this)) return this[i];
        }
        return undefined;
    };
}
