/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
enyo.kind({
    name: "kindle.kindle_panels.BookInfoView",
    kind: enyo.VFlexBox,
    events: {
        onMarkupsResultSelected: ""
    },
    className: "bookinfo-panel",
    components: [
            {kind: "HFlexBox", className: "tab-container", components: [
               {name: "bookInfoRadioGroup",  width: '100%', kind: "RadioGroup", onclick: "TocRadioGroupClick", components: [
                    {label: $L('Cover'), value: 0, flex:0, className: "tab-label", icon: "images/tab-icon-cover.png"},
                    {label: $L('Marks'), value: 2, flex:0, className: "tab-label", icon: "images/tab-icon-markup.png"}
               ]},
				{kind: 'Spacer'}
               //{content: "Harry Potter and the Goblet of Fire", domStyles: {padding: "20px 0 0 50px"}},
            ]},
			{className: "tab-box-shadow"},
            {kind: "Pane", name:"bookInfoPane", transitionKind: "enyo.transitions.Simple", className: "info-container", flex: 1, components: [
                {name: "coverView", kind:"kindle.kindle_panels.CoverView"},
                {name: "tocView", kind:"kindle.kindle_panels.ToCView"},
                {name: "markupsView", kind:"kindle.kindle_panels.MarkupsView", onMarkupsResultSelected: "doMarkupsResultSelected"}
            ]}
    ],

    create: function() {
        this.inherited(arguments);
    },

    rendered: function() {
        this.inherited(arguments);
        this.$.bookInfoRadioGroup.setValue(0);
        this.$.bookInfoPane.selectViewByName("coverView");
    },
    
    TocRadioGroupClick: function(inSender) {
		this.setView(inSender.getValue());
	},
    
    setView: function(value) {
		if (this.$.bookInfoRadioGroup.value != value) {
			this.$.bookInfoRadioGroup.setValue(value);
		}
		switch(value) {
			case 0:
				this.$.bookInfoPane.selectViewByName("coverView");
				break;
			case 1:
				this.$.bookInfoPane.selectViewByName("tocView");
				break;
			case 2:
				this.$.bookInfoPane.selectViewByName("markupsView");
				this.$.markupsView.setupView();
				break;
			default:
				break;
		}
    }
});