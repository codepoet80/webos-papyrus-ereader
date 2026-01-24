/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
enyo.kind({
    name: "kindle.kindle_panels.CoverView",
    kind: enyo.VFlexBox,
    components: [
        {name: "largeCoverImage", kind:"Image", domStyles: { margin: "30px 0 0 90px"}},
		{name: "nocover", className: "coverView-book-nocover", content: $L("No Cover Image Available"), showing: false},
    ],
    create: function() {
        this.inherited(arguments);
    },
	setImage: function(imgSrc) {
		this.$.largeCoverImage.setSrc(imgSrc.replace(/-medium./i,"-large.").replace(/-small./i,"-large."));
		this.$.largeCoverImage.srcChanged();
		
		if (imgSrc === "images/item-cover-default-large.png") {
			//this.$.title.setContent(bookItem.title);
			this.$.nocover.setShowing(true);
		} else {
			this.$.nocover.setShowing(false);
		}
	}

});

