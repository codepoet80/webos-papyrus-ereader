enyo.kind({
	name: "ereader.reading.DogEarButton",
	kind: "CustomButton", toggling: true,
	components: [
		{name: "icon", className: "dogearButton"},
	],
	
	toggle: function(val) {
		if (val != null) {
			this.setDepressed(val);
		}
		else {
			this.depressed = !this.$.theButton.depressed;
		}
	},
	
	isButtonDown: function() {
		return this.depressed;
	}
});
