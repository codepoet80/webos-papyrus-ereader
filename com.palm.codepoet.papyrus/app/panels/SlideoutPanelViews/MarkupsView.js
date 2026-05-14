/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
enyo.kind({
    name: "kindle.kindle_panels.MarkupsView",
    kind: enyo.VFlexBox,
    events: {
        onMarkupsResultSelected: ""
    },
	className: "slideout-panel",
    //className: "slideout-panel",
    components: [
        // {name:"findBooks", method: "find", kind: "DbService", dbKind: "com.palm.kindle.books:1", onSuccess: "findBooksResponse", onFailure: "dbFailure", subscribe: true, onWatch: "refreshView"},
        {kind: "DbList", name: "listMarkups", flex: 1, onQuery: "listQuery", onSetupRow: "listSetupRow", components: [
                {kind: "HFlexBox", name: "listItemContainer", components: [
                        {kind: "kindle.kindle_panels.MarkupsItem", flex: 1, name: "listItem", onClickHandler: "ClickHandler", onMarkupsResultSelected: "doMarkupsResultSelected"}
                ]},
            ]
        },
        {name: "noMarksIndicator", layoutKind: "HFlexLayout", className: "no-marks-indicator", components: [
                {content: $L("No Bookmarks have been created for this book")}
            ]
        },
        {name:"annotationService", kind: "DbService", dbKind: "com.palm.kindle.annotations:1", components:[
                {name: "findAnnotations", method: "find", onSuccess: "findBooksResponse", onFailure: "dbFailure", subscribe: true, onWatch: "markupsQueryWatch"},
                {name: "addAnnotations", method: "put", subscribe:false, onFailure: "dbFailure"},
                {name: "mergeAnnotationProps", method: "merge", subscribe:false, onSuccess: "mergeAnnotationPropsSuccess", onFailure: "dbFailure"},
                {name: "findAnnotationsWithNoText", method: "find", onSuccess: "findAnnotationsWithNoTextSuccess", onFailure: "dbFailure"/*, subscribe: true, onWatch: "findAnnotationsWithNoTextWatch"*/},
        ]},
    ],
    create: function() {
        this.inherited(arguments);
        this.currentBook = "";
    },

    setCurrentBook: function(newCurrentBook) {
        this.currentBook = newCurrentBook;
    },

    fetchAnnotationsWithNoText: function() {
        this.log("fetchAnnotationsWithNoText Called!");
        var param = {
            "query": {
                "from":"com.palm.kindle.annotations:1",
                "where": [
					{"prop": "isDeleted", "op": "=", "val": "0"},
					{"prop": "contentIdentifier", "op": "=", "val": this.currentBook.asin},
					{"prop": "contentGuid", "op": "=", "val": this.currentBook.guid},
					{"prop": "contentType", "op": "=", "val": this.currentBook.type}
				],
				"orderBy": "start"
            }
        };
        this.$.findAnnotationsWithNoText.call(param);
    },

    findAnnotationsWithNoTextSuccess: function(inSender, inResponse, inRequest) {  
        this.log("findAnnotationsWithNoTextSuccess called!" + JSON.stringify(inResponse));
        var text;
        var param, objectsArray;
        var loc, pos, sentence;
        
        objectsArray = [];
        
        if (inResponse.results.length > 0) {
            for (var i = 0; i < inResponse.results.length; i++) {
                if(typeof(inResponse.results[i].sentenceText) == 'undefined' || typeof(inResponse.results[i].nearestLocation) == 'undefined')
                {
                    if (inResponse.results[i].annotationType == "Bookmark") {
                        ///----OLD CODE---
						///text = main_reader_body_krfPlugin.getSentenceWithLocation(inResponse.results[i].start, 0, 0, 25);
						text = main_reader_body_krfPlugin.getSentenceWithLocation(inResponse.results[i].start, "0", 0, 25);
                        if (text != null){
                            loc = text.split("#",1);
                            pos = text.indexOf("#");
                            sentence = text.substring(pos+1, text.length);

                            objectsArray.push({"_id": inResponse.results[i]._id, "sentenceText": sentence , "nearestLocation": loc});
                        }
                    }
                    else if (inResponse.results[i].annotationType == "Highlight") {
                        text = main_reader_body_krfPlugin.getSentenceWithLocation(inResponse.results[i].start, inResponse.results[i].end, 0, 0);

                        if (text != null){
                            objectsArray.push({"_id": inResponse.results[i]._id, "sentenceText": text});
                        }
                    }
                    else if (inResponse.results[i].annotationType == "Note") {
						///----OLD CODE---
                        // text = main_reader_body_krfPlugin.getSentenceWithLocation(inResponse.results[i].start, "0", 0, 5);
                        // 
                        // if (text != null){
                        //     loc = text.split("#",1);
                        // 
                        //     objectsArray.push({"_id": inResponse.results[i]._id, "nearestLocation": loc});
                        // }
						loc = main_reader_body_krfPlugin.convertPositionToLocation(inResponse.results[i].start);

						objectsArray.push({"_id": inResponse.results[i]._id, "nearestLocation": loc});
						
                    }
                }
            }
            param = { "objects": objectsArray };
                
            this.$.mergeAnnotationProps.call(param);
        }
    },
    
    mergeAnnotationPropsSuccess : function(){
        this.$.listMarkups.resized();
        setTimeout(enyo.bind(this, function() {
            this.$.listMarkups.reset();
            //this.$.listMarkups.punt();
		}), 1000);
        //this.$.listMarkups.render();
        this.log("mergeAnnotationPropsSuccess");
    },
    
    findAnnotationsWithNoTextWatch : function(){

    },

    setupView: function() {
        this.$.noMarksIndicator.hide();
        this.fetchAnnotationsWithNoText();
        //this.$.listMarkups.punt();
        this.$.listMarkups.reset();
    },

    listQuery: function(inSender, inQuery) {
        this.log("listQuery Called from Markups View!");
        this.log("inQuery is" + JSON.stringify(inQuery));
        
        inQuery["from"] = "com.palm.kindle.annotations:1";
        inQuery["where"] = [
			{"prop": "isDeleted", "op": "=", "val": "0"},
			{"prop": "contentIdentifier", "op": "=", "val": this.currentBook.asin},
			{"prop": "contentGuid", "op": "=", "val": this.currentBook.guid},
			{"prop": "contentType", "op": "=", "val": this.currentBook.type}
		];
		inQuery["orderBy"] = "start";


        return this.$.findAnnotations.call({query: inQuery});
        //return this.owner.owner.owner.$.reader.$.body.$.findAnnotations.call(param);
    },

    listSetupRow: function(inSender, inRecord, inIndex) {
		if (inRecord) {
	        this.log("listSetupRow called from Markups View!");
	        this.log(JSON.stringify(inRecord));
        
	        this.$.listItem.setupItem(inRecord);
	        return true;
		}
    },

    // On db Service Success:
    findBooksResponse: function(inSender, inResponse, inRequest) {
        this.log("inResponse:" + JSON.stringify(inResponse));
        if (inResponse.results.length == 0) {
            this.$.noMarksIndicator.show();
        }
        this.$.listMarkups.queryResponse(inResponse, inRequest);
    },

    // On db Service Failure:
    dbFailure: function(inSender, inError, inRequest) {
            this.log(JSON.stringify(inError));
    },

    markupsQueryWatch: function() {
        console.log("Markups 2");
		console.log("dbService watch fired");
        this.$.listMarkups.punt();
        this.$.listMarkups.reset();
        this.$.listMarkups.refresh();
    },
    
    ClickHandler: function(inSender, rowIndex) {
        var item = this.$.listMarkups.fetch(rowIndex);
        
        this.doMarkupsResultSelected(item.pagePosition, item.start, item.pageSnapshotBuffer);
    },
    
});


enyo.kind({
    name: "kindle.kindle_panels.MarkupsItem",
    kind: enyo.Item,
    tapHighlight: true,
    className: "",
    published : { pageLocation: "", pagePosition: "", startPosition: "", pageSnapshotBuffer: ""},
    events: {
        /*onMarkupsResultSelected: "",*/ onClickHandler: ""
    },
 	onclick: "clickHandler",
    components: [
		{kind: "HFlexBox", components: [
			{kind: "Flyweight", style:"color:black;", name: "text", flex: 1, content:"", style: "margin:25px; word-wrap:break-word;"},
			{kind: "VFlexBox", style:"text-align:right;margin:25px;", components: [
				{name: "doggie", kind: "Image", src: "images/markups-icon-dog-ear.png", style: "vertical-align: baseline;", showing: false},
				{name: "lineNum", content:"" }
			]}
		]},
        {nodeTag: "hr", domStyles: {margin: "0px 10px 0px 10px"}}
    ],

    create: function() {
        this.inherited(arguments);
        this.annotationType = "";
        this.pageLocation = "";
        this.pagePosition = "";
        this.startPosition = "";
        this.pageSnapshotBuffer = "";

    },
    
    
    clickHandler: function(inSender,inEvent){
        this.doClickHandler(inEvent.rowIndex);
    },
    /********************************
     *Old way to send the properties:
     ********************************
    clickHandler: function(inSender, inEvent) {
        this.doMarkupsResultSelected(this.pagePosition, this.startPosition, this.pageSnapshotBuffer);
    },*/

    setupItem: function() {
        var strText = "";
        var maxNumToDisplay = 120;

        this.importProps(arguments[0]);
        this.annotationType = arguments[0].annotationType;

        this.pagePosition = arguments[0].pagePosition;
        this.pagePositionChanged();
        this.startPosition = arguments[0].start;
        this.startPositionChanged();
        this.pageSnapshotBuffer = arguments[0].pageSnapshotBuffer;
        this.pageSnapshotBufferChanged();

        switch(this.annotationType) {
            case "Note":
                if(typeof(arguments[0].userText) != 'undefined') {
                    strText = arguments[0].userText;
                    strText = strText.substring(0, maxNumToDisplay);

                    if(arguments[0].userText.length > parseInt(maxNumToDisplay)){
                        strText += "...";
                    }
                    this.$.text.content = "<i>" + strText + "</i>";
                }
                else {this.log("UserText is undefined in this Note");}

                if(typeof(arguments[0].nearestLocation) != 'undefined') {
                    this.pageLocation = arguments[0].nearestLocation;
                    this.pageLocationChanged();
                }
                else {this.log("NearestLocation is undefined in this Note");}
            break;
            case "Bookmark":
                if(typeof(arguments[0].sentenceText) != 'undefined') {
                    strText = arguments[0].sentenceText;
                    strText = strText.substring(0, maxNumToDisplay);

                    if(arguments[0].sentenceText.length > parseInt(maxNumToDisplay)){
                        strText += "...";
                    }

                    this.$.text.content = strText;
                }
                else {this.log("SentenceText is undefined in this Bookmark");}

                if(typeof(arguments[0].nearestLocation) != 'undefined') {
                    this.pageLocation = arguments[0].nearestLocation;
                    this.pageLocationChanged();
                }
                else {this.log("NearestLocation is undefined in this Bookmark");}
                //this.$.text.setContent(main_reader_body_krfPlugin.getSentence(arguments[0].start, 0, 0, 30));
                this.$.doggie.setShowing(true);
            break;
            case "Highlight":
                if(typeof(arguments[0].sentenceText) != 'undefined') {
                    var str = arguments[0].sentenceText;
                    var loc = str.split("#",1);
                    this.pageLocation = loc;
                    this.pageLocationChanged();

                    var pos = str.indexOf("#");
                    var sentence = str.substring(pos+1, str.length);

                    var len = sentence.length;

                    sentence = sentence.substring(0, maxNumToDisplay);
                    if(len > parseInt(maxNumToDisplay)){
                        sentence += "...";
                    }

                    this.$.text.content = "<span style=\"background-color: #f8f5cb\">" + sentence + "</span>";
                }
                else {this.log("SentenceText is undefined in this Highlight");}
                //this.$.text.setContent(main_reader_body_krfPlugin.getSentence(arguments[0].start, arguments[0].end, 0, 0));
            break;
        }
        var strTmp = new enyo.g11n.Template($L("Location #{loc}"));
        this.$.lineNum.setContent(strTmp.evaluate({loc: this.pageLocation}));
        
    },

    pageLocationChanged: function(){

    },

    pagePositionChanged: function(){

    },

    startPositionChanged: function(){

    },

    pageSnapshotBufferChanged: function(){

    }

});


