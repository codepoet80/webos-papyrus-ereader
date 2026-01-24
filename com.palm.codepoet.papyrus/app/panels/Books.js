/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
enyo.kind({
    name: "kindle.kindle_panels.Books",
    kind: enyo.VFlexBox,
    className: "Books",
    components: [
        {name: "header", kind: "PageHeader", components: [
			{content: $L("Page Header")}
		]},
        {kind: "Toolbar", style: "position:absolute; bottom:1px;",components: [
			{name: "slidingDrag", slidingHandler: true, kind: "Control", className: "enyo-command-menu-draghandle"}
        ]}

    ],
    //create: function() {}, //<-if I include that line the contents of the VFlexBox are not seen.
    //constructor: function() {}
    rendered: function()
    {
        this.inherited(arguments);
    }
});

