enyo.kind({
	name: "kindle.StoreNavigator",
	kind: enyo.VFlexBox,
	domStyles: { background: "#cac5b8" },
	components: [
		{kind: "WebView", name: "webView", flex: 1}
	],
	
	create: function() {
		this.inherited(arguments);
	},
	
	showStore: function() {
		this.$.webView.url = "http://www.amazon.com/Kindle-eBooks";
		this.$.webView.activate();
	}
});
