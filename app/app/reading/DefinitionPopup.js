/**
 * ereader.reading.DefinitionPopup - centered dictionary definition card
 *
 * Opened by BookReader when the user taps a word in Define mode.  Shows a
 * "Looking up…" spinner immediately, then fills in with the definition (or an
 * error).  Modeled on the About dialog (Main.js): a centered Popup with a
 * rounded "aboutBox"-style card.
 *
 * Modal + scrim: outside taps are swallowed by the scrim rather than dismissing
 * the popup.  This deliberately avoids the isTrusted duplicate-event dismiss bug
 * (CLAUDE.md fix #17) where the native mousedown that follows our synthetic one
 * would immediately close a non-modal popup.  The user dismisses with Close.
 *
 * The card is themed white/sepia/black via changeCSSClassesTo(), called from
 * BookReader.updateThemeClass so the definition matches the reader theme.
 */
enyo.kind({
	name: "ereader.reading.DefinitionPopup",
	kind: "Popup",
	scrim: true,
	modal: true,
	lazy: false,
	className: "definitionBox white",
	style: "padding: 18px;",
	width: "320px",
	components: [
		{kind: "VFlexBox", components: [
			{name: "wordTitle", content: "", className: "definitionWord", allowHtml: true},
			{name: "phonetic", content: "", className: "definitionPhonetic", showing: false},
			{name: "loadingRow", kind: "HFlexBox", align: "center", showing: false, style: "margin: 14px 0;", components: [
				{kind: "Spinner"},
				{name: "loadingText", content: $L("Looking up…"), style: "margin-left: 10px;"}
			]},
			{name: "bodyScroller", className: "definitionScroller", components: [
				{name: "bodyContent", content: "", allowHtml: true, className: "definitionBody"}
			]},
			{kind: "Button", content: $L("Close"), className: "enyo-button-dark definitionClose", onclick: "handleClose"}
		]}
	],

	events: {
		onClosed: ""
	},

	// Show the loading state for a freshly-tapped word.
	showLoading: function(word) {
		this.$.wordTitle.setContent(this._escape(word));
		this.$.phonetic.hide();
		this.$.bodyContent.setContent("");
		this.$.bodyScroller.hide();
		this.$.loadingRow.show();
		this.openAtCenter();
	},

	// Fill in a successful definition.  entry is the first object from the
	// Dictionary API (has .word, .phonetic, .phonetics[], .meanings[]).
	showDefinition: function(word, entry) {
		this.$.loadingRow.hide();

		var displayWord = (entry && entry.word) ? entry.word : word;
		this.$.wordTitle.setContent(this._escape(displayWord));

		var phonetic = this._pickPhonetic(entry);
		if (phonetic) {
			this.$.phonetic.setContent(this._escape(phonetic));
			this.$.phonetic.show();
		} else {
			this.$.phonetic.hide();
		}

		this.$.bodyContent.setContent(this._buildDefinitionHtml(entry));
		this.$.bodyScroller.show();
		if (!this.isOpen) this.openAtCenter();
	},

	// Show an error state (word not found / no connection).
	showError: function(word, message) {
		this.$.loadingRow.hide();
		this.$.wordTitle.setContent(this._escape(word));
		this.$.phonetic.hide();
		this.$.bodyContent.setContent('<div class="definitionError">' + this._escape(message) + '</div>');
		this.$.bodyScroller.show();
		if (!this.isOpen) this.openAtCenter();
	},

	handleClose: function() {
		this.close();
		this.doClosed();
	},

	changeCSSClassesTo: function(theclass) {
		this.removeClass("white");
		this.removeClass("sepia");
		this.removeClass("black");
		this.addClass(theclass);
	},

	// -----------------------------------------------------------------
	// Rendering helpers
	// -----------------------------------------------------------------

	// Cap what we show so the card stays glanceable: first 2 parts of speech,
	// first 3 senses each.  The scroller handles anything longer.
	_buildDefinitionHtml: function(entry) {
		if (!entry || !entry.meanings || !entry.meanings.length) {
			return '<div class="definitionError">' + $L("No definition found.") + '</div>';
		}
		var MAX_POS = 2, MAX_DEF = 3;
		var html = "";
		var meanings = entry.meanings;
		for (var i = 0; i < meanings.length && i < MAX_POS; i++) {
			var m = meanings[i];
			if (m.partOfSpeech) {
				html += '<div class="def-pos">' + this._escape(m.partOfSpeech) + '</div>';
			}
			var defs = m.definitions || [];
			html += '<ol class="def-list">';
			for (var j = 0; j < defs.length && j < MAX_DEF; j++) {
				html += '<li>' + this._escape(defs[j].definition || "");
				if (defs[j].example) {
					// Straight quotes — curly quotes are safe on modern fonts but
					// avoided here to stay renderable on webOS's limited font set.
					html += '<div class="def-ex">&quot;' + this._escape(defs[j].example) + '&quot;</div>';
				}
				html += '</li>';
			}
			html += '</ol>';
		}
		return html;
	},

	_pickPhonetic: function(entry) {
		if (!entry) return "";
		// The phonetic field is IPA (e.g. /ˈparədɒks/).  webOS's old WebKit has no
		// font covering IPA, so those glyphs render as placeholder boxes — suppress
		// the whole line there.  Modern PWA/desktop browsers render IPA fine.
		if (typeof window !== "undefined" && window.PalmSystem) return "";
		if (entry.phonetic) return entry.phonetic;
		var ph = entry.phonetics || [];
		for (var i = 0; i < ph.length; i++) {
			if (ph[i] && ph[i].text) return ph[i].text;
		}
		return "";
	},

	_escape: function(s) {
		if (s == null) return "";
		return String(s)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}
});
