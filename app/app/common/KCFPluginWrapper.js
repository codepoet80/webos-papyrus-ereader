enyo.kind({
    name: "kindle.KCFPluginWrapper",
    kind: "enyo.Control",
    nodeTag: "object",
    content: '<param name="exe" value="plugin_kcf">',

    create: function() {
        this.inherited(arguments);
		if (window.PalmSystem == null) {
			this.destroy();
			return;
		}
        this.domAttributes.type = "application/x-palm-remote";
        this.setAttribute("width", 0);
        this.setAttribute("height", 0);
        this.setAttribute("enyo-pass-events", "true");
    },
	
	ready: function() {
		window.KCF_PLUGIN = this;
	},
	
	RegisterDevice: function(usrName,password) {
		if (this.hasNode()) {
			return window.KCF_PLUGIN.node.RegisterDevice(usrName,password);
		}
		return null;
	}
});
