/**
 * MojoCompat.js - Compatibility shim for Mojo APIs used by Preader
 *
 * This provides stub/replacement implementations of Mojo framework APIs
 * so that Preader's pure-JS code can work without the Mojo framework.
 */

// Create the Mojo namespace if it doesn't exist
if (typeof Mojo === "undefined") {
	window.Mojo = {};
}

// Mojo.Log - use console instead
Mojo.Log = {
	info: function() { console.log.apply(console, arguments); },
	warn: function() { console.warn.apply(console, arguments); },
	error: function() { console.error.apply(console, arguments); }
};

// Mojo.Controller - UI controller methods
Mojo.Controller = {
	errorDialog: function(msg) {
		console.error("Error: " + msg);
		// Try to show an error via the main app if available
		if (window.EReaderApp && window.EReaderApp.showError) {
			window.EReaderApp.showError("Error", msg);
		} else {
			alert(msg);
		}
	}
};

// Mojo.Function.Synchronize - Async operation coordinator
// This is a simple implementation that tracks when all wrapped callbacks have been called
Mojo.Function = {
	Synchronize: function(options) {
		this.syncCallback = options.syncCallback;
		this.pendingCount = 0;
		this.completed = false;
	}
};

Mojo.Function.Synchronize.prototype.wrap = function(callback) {
	var self = this;
	this.pendingCount++;

	return function() {
		// Call the original callback
		if (callback) {
			callback.apply(this, arguments);
		}

		// Decrement counter and check if all done
		self.pendingCount--;
		if (self.pendingCount <= 0 && !self.completed) {
			self.completed = true;
			if (self.syncCallback) {
				// Use setTimeout to avoid potential stack issues
				setTimeout(function() {
					self.syncCallback();
				}, 0);
			}
		}
	};
};

// Mojo.Depot - Simple key-value storage (use localStorage instead)
Mojo.Depot = function(options, onSuccess, onFailure) {
	this.name = options.name || "depot";
	// Call success callback asynchronously
	if (onSuccess) {
		setTimeout(onSuccess, 0);
	}
};

Mojo.Depot.prototype.get = function(key, onSuccess, onFailure) {
	try {
		var value = localStorage.getItem(this.name + "_" + key);
		if (value !== null) {
			value = JSON.parse(value);
		}
		if (onSuccess) {
			setTimeout(function() { onSuccess(value); }, 0);
		}
	} catch (e) {
		if (onFailure) {
			setTimeout(function() { onFailure(e); }, 0);
		}
	}
};

Mojo.Depot.prototype.add = function(key, value, onSuccess, onFailure) {
	try {
		localStorage.setItem(this.name + "_" + key, JSON.stringify(value));
		if (onSuccess) {
			setTimeout(onSuccess, 0);
		}
	} catch (e) {
		if (onFailure) {
			setTimeout(function() { onFailure(e); }, 0);
		}
	}
};

Mojo.Depot.prototype.discard = function(key, onSuccess, onFailure) {
	try {
		localStorage.removeItem(this.name + "_" + key);
		if (onSuccess) {
			setTimeout(onSuccess, 0);
		}
	} catch (e) {
		if (onFailure) {
			setTimeout(function() { onFailure(e); }, 0);
		}
	}
};

// Mojo.Model - Encryption stubs (NOT secure, just for compatibility)
Mojo.Model = {
	encrypt: function(key, data) {
		// Simple XOR-based obfuscation (NOT secure encryption!)
		// For a real implementation, use Web Crypto API
		if (!data) return "";
		var result = "";
		for (var i = 0; i < data.length; i++) {
			result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
		}
		return btoa(result);
	},
	decrypt: function(key, data) {
		if (!data) return "";
		try {
			var decoded = atob(data);
			var result = "";
			for (var i = 0; i < decoded.length; i++) {
				result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
			}
			return result;
		} catch (e) {
			return "";
		}
	}
};

// Mojo.parseJSON - just use JSON.parse
Mojo.parseJSON = function(str) {
	return JSON.parse(str);
};

// Mojo.Service.Request - Palm service calls (stub)
Mojo.Service = {
	Request: function(url, options) {
		console.warn("Mojo.Service.Request called but not supported: " + url);
		// Call failure callback if provided
		if (options && options.onFailure) {
			setTimeout(function() {
				options.onFailure({errorCode: -1, errorText: "Service not available"});
			}, 0);
		}
	}
};

// Mojo.Event - Event handling
Mojo.Event = {
	send: function(target, eventType, data) {
		var event = document.createEvent("CustomEvent");
		event.initCustomEvent(eventType, true, true, data);
		target.dispatchEvent(event);
	}
};

// String.prototype.strip - Prototype.js feature (equivalent to trim)
if (!String.prototype.strip) {
	String.prototype.strip = function() {
		return this.replace(/^\s+|\s+$/g, '');
	};
}

// String.prototype.trim polyfill
if (!String.prototype.trim) {
	String.prototype.trim = function() {
		return this.replace(/^\s+|\s+$/g, '');
	};
}

// String.prototype.startsWith polyfill (ES6)
if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(searchString, position) {
		position = position || 0;
		return this.indexOf(searchString, position) === position;
	};
}

// String.prototype.endsWith polyfill (ES6)
if (!String.prototype.endsWith) {
	String.prototype.endsWith = function(searchString, position) {
		var subjectString = this.toString();
		if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
			position = subjectString.length;
		}
		position -= searchString.length;
		var lastIndex = subjectString.lastIndexOf(searchString, position);
		return lastIndex !== -1 && lastIndex === position;
	};
}

// String.prototype.includes polyfill (ES6)
if (!String.prototype.includes) {
	String.prototype.includes = function(search, start) {
		if (typeof start !== 'number') {
			start = 0;
		}
		if (start + search.length > this.length) {
			return false;
		}
		return this.indexOf(search, start) !== -1;
	};
}

// Array.prototype.find polyfill (ES6)
if (!Array.prototype.find) {
	Array.prototype.find = function(predicate) {
		if (this == null) {
			throw new TypeError('Array.prototype.find called on null or undefined');
		}
		if (typeof predicate !== 'function') {
			throw new TypeError('predicate must be a function');
		}
		var list = Object(this);
		var length = list.length >>> 0;
		var thisArg = arguments[1];
		var value;
		for (var i = 0; i < length; i++) {
			value = list[i];
			if (predicate.call(thisArg, value, i, list)) {
				return value;
			}
		}
		return undefined;
	};
}

// Array.prototype.findIndex polyfill (ES6)
if (!Array.prototype.findIndex) {
	Array.prototype.findIndex = function(predicate) {
		if (this == null) {
			throw new TypeError('Array.prototype.findIndex called on null or undefined');
		}
		if (typeof predicate !== 'function') {
			throw new TypeError('predicate must be a function');
		}
		var list = Object(this);
		var length = list.length >>> 0;
		var thisArg = arguments[1];
		for (var i = 0; i < length; i++) {
			if (predicate.call(thisArg, list[i], i, list)) {
				return i;
			}
		}
		return -1;
	};
}

// Function.prototype.defer - Prototype.js feature for delayed execution
if (!Function.prototype.defer) {
	Function.prototype.defer = function() {
		var fn = this;
		var args = Array.prototype.slice.call(arguments);
		return setTimeout(function() {
			fn.apply(fn, args);
		}, 10);
	};
}

// Function.prototype.bind polyfill (just in case)
if (!Function.prototype.bind) {
	Function.prototype.bind = function(context) {
		var fn = this;
		var args = Array.prototype.slice.call(arguments, 1);
		return function() {
			var innerArgs = Array.prototype.slice.call(arguments);
			return fn.apply(context, args.concat(innerArgs));
		};
	};
}

// Array.prototype.include - Prototype.js feature
if (!Array.prototype.include) {
	Array.prototype.include = function(item) {
		return this.indexOf(item) !== -1;
	};
}

// Array.prototype.clone - Prototype.js feature
if (!Array.prototype.clone) {
	Array.prototype.clone = function() {
		return this.slice(0);
	};
}

// Element.prototype.update - Prototype.js feature (sets innerHTML)
if (typeof Element !== "undefined" && !Element.prototype.update) {
	Element.prototype.update = function(content) {
		this.innerHTML = content || "";
		return this;
	};
}

// Also add to HTMLElement for good measure
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.update) {
	HTMLElement.prototype.update = function(content) {
		this.innerHTML = content || "";
		return this;
	};
}

console.log("MojoCompat.js loaded - Mojo compatibility shim active");
