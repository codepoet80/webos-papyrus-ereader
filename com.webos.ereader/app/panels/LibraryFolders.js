/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
enyo.kind({
    name: "kindle.kindle_panels.LibraryFolders",
    kind: enyo.VFlexBox,
    events: {
        onTocPanelBtnClicked: ""
    },
    components: [
        {name: "Header", kind: "PageHeader", components: [
				{content: $L("Library")}
			]},
        {name: "LibraryScroller", kind: "Scroller", flex: 1, onscroll: "libraryScroll", components: [
                {name: "libraryList", kind: "List", onGetItem: "getLibraryItem"}
        ]},
        {name: "TocPanelBtn", kind: "Button", caption: "ToC Panel Btn" ,onclick: "TocPanelBtnClick"}
    ],
    //create: function() {}, //<-if I include that line the contents of the VFlexBox are not seen.
    //constructor: function() {}
    create: function()
    {
        this.inherited(arguments);
        this.$.libraryList.build();
    },
    rendered: function()
    {
        this.inherited(arguments);
    },
    libraryScroll: function(inSender)
    {

    },
    getLibraryItem: function(inSender, inIndex)
    {
        if (inIndex < 5)
        {
            return [{kind: "kindle.kindle_panels.LibraryFolderItem"}]
        }
    },
    TocPanelBtnClick: function(inSender)
    {
        this.doTocPanelBtnClicked();
    }
});

enyo.kind({
    name: "kindle.kindle_panels.LibraryFolderItem",
    kind: enyo.Item,
    tapHighlight: false,
    components: [
        {name: "folder", content:"Library Folder"}
    ],
    clickHandler: function() {
        
    }
})