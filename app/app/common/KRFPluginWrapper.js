enyo.kind({
	name: "kindle.KRFPluginWrapper",
    kind: "enyo.Control",
    nodeTag: "object",
    content: '<param name="exe" value="KindlePluginUtil">',
	requiresDomMousedown: true,
    create: function() {
        this.inherited(arguments);
		if (window.PalmSystem == null) {
			this.destroy();
			return;
		}
        this.domAttributes.type = "application/x-palm-remote";
        this.setAttribute("width", 768);
        this.setAttribute("height", 1024);
        this.setAttribute("enyo-pass-events", "true");
		this.initialized = false;
    },
	
	ready: function() {
		window.KRF_PLUGIN = this;
	},
	
	initializeBook: function(bookPath) {
		if (this.hasNode()) {
			this.node.initializeBook(bookPath);
			this.initialized = true;
			return true;
		}
		return false;
	},
	
	getTitle: function() {
		if (this.hasNode() && this.initialized) {
			return this.node.getTitle();
		}
		return false;
	},
	
	chooseAlice: function() {
		chooseBook("/media/internal/.palmkindle/Alice.mobi");
	},
	
	getAuthor: function() {
		if (this.hasNode() && this.initialized) {
			return this.node.getAuthor();
		}
		return false;		
	},
	
	getCoverImage: function() {
		if (this.hasNode() && this.initialized) {
			return this.node.getCoverImage(this.getAuthor() + " - " + this.getTitle());
		}
		return false;		
	},
	
	gotoNextPage: function() {
		if (this.hasNode() && this.initialized) {
			return this.node.gotoNextPage();
		}
		return false;		
	},
	
	getCurrentPageImage: function() {
		if (this.hasNode() && this.initialized) {
			return this.node.getCurrentPageImage();
		}
		return false;		
	}
});
