/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
enyo.kind({
    name: "kindle.kindle_panels.SearchView",
    kind: enyo.VFlexBox,
	published : { searchString: "", listCount: "", renderedItemCount:""},
    events: {
        onSearchResultSelected: "",
        onSearchQueried: ""
    },
	className: "",
    components: [
		{kind: "HFlexBox", style: "margin:2px 40px 0px 0px", components: [
			{name: "searchResultsCount", flex: 1, style: "margin: 0px 0px 0px 20px;color:#51514d;font-size: 32px;"},
            {kind:"Spinner", name: "searchSpinner", style: "margin: 6px;"},
			{kind: "kindle.ExpandingSearchBox", width:"240px", name: "searchBox", onSearchQueried: "doSearchQueried", onSearchChanged: "handleSearchChanged", collapsible: false}
		]},
		{nodeTag: "hr", domStyles: {margin: "0px 20px 0px 20px"}},
        {name: "SearchScroller", kind: "Scroller", flex: 1, style: "margin: 0px 40px 0px 40px", accelerated: true, onScroll: "onSearchScroll", onScrollStart:"onSearchScrollStart", onScrollStop:"onSearchScrollStop",  components: [
			{name: "SearchResultsList", kind: "VFlexBox", onSearchResultSelected: "doSearchResultSelected", onGetItem: "getSearchResultsItem"}
        ]},
        /*{content:"", name:"SearchResponse", domStyles: {padding: "10px 0 0 20px"}}*/
    ],
	create: function() {
		this.inherited(arguments);

		this.searchString = "";
		this.searchStringChanged();

		this.listCount = 0;
		this.listCountChanged();

		this.renderedItemCount = 0;
		this.renderedItemCountChanged();

		// this.numResultsToReturn stores the amount of results KRF will return at one time.
		this.numResultsToReturn = 5;
		// this.numResultsBeforePause stores the number of search results to display before pausing search.
		this.numResultsBeforePause = 100;
		
		// TODO: Remove 'this.dblSpaceRegex' when the Work-around in showSearchResults is removed
		this.dblSpaceRegex = new RegExp("  ", "gi");
	},
	
	rendered: function() {
		this.inherited(arguments);
		this.owner.owner.$.reader.$.body.$.krfPlugin.addCallback("populateSearchResults", enyo.bind(this, "populateSearchResults"));
		this.$.SearchResultsList.rendered = enyo.bind(this, "SearchResultsListRendered");
	},

	SearchResultsListRendered: function() {
		//this.log("SearchResultsListRENDERED!");
		this.renderedItemCount++;
		this.renderedItemCountChanged();

		this.log("ListCount: " + this.listCount + " renderedItemCount: " + this.renderedItemCount + "modRESULT: " + (this.listCount % this.numResultsBeforePause));
		if ((this.listCount %this.numResultsBeforePause) != 0) {
			if (this.renderedItemCount == this.numResultsToReturn) {	
				if(window.PalmSystem) {
					this.owner.owner.$.reader.$.body.$.krfPlugin.callPluginMethod("getDocumentSearchResults", this.searchString, this.numResultsToReturn);
				}
                this.log("renderedItemCount has been reset1");
                this.renderedItemCount = 0;
				this.renderedItemCountChanged();
			}
		}
        else if (this.listCount == 0) { /*do nothing (first result 0 mod numResultsBeforePause is 0)*/ }
        else {
            this.log("renderedItemCount has been reset2");
			this.renderedItemCount = 0;
			this.renderedItemCountChanged();
		}
	},

	stopSearch: function() {
		this.log("Search STOPPED!");
		this.renderedItemCount = -this.numResultsToReturn;
		this.renderedItemCountChanged();
		this.$.searchSpinner.hide();
	},

	searchStringChanged: function() {

	},
	listCountChanged: function() {

	},

	renderedItemCountChanged: function() {

	},
    
    handleSearchChanged: function(insender, str) {
        if(str == null)
        {
            if (!this.$.searchSpinner.showing)
            {
                this.cleanSearchResults();
            }
            else this.stopSearch();
            
            //this.$.SearchResultsList.destroyControls();
        }
    },
    
    cleanSearchResults: function()
    {
        var strTmp = new enyo.g11n.Template($L("#{num} results"));
        
        this.$.SearchResultsList.destroyControls();
        this.$.searchResultsCount.setContent(strTmp.evaluate({
            num: (0)
        }));
        this.$.searchResultsCount.render();
    },

	Search: function(searchString) {
        ///---Karthik: First reset Search
		if(window.PalmSystem) {
			//this.owner.owner.$.reader.$.body.$.krfPlugin.callPluginMethod("resetSearch");
			this.owner.owner.$.reader.$.body.$.krfPlugin.callPluginMethod("initializeSearch");
		}
		
		///---Karthik: Then Destroy all controls
		var strTmp = new enyo.g11n.Template($L("#{num} results"));
		this.$.searchResultsCount.setContent(strTmp.evaluate({
			num: 0
		}));
		this.$.SearchResultsList.destroyControls();
		this.searchString = searchString;
		this.searchStringChanged();
		this.$.searchBox.setValue(this.searchString);
		this.$.searchBox.showSearchBox();

		this.listCount = 0;
		this.listCountChanged();

		this.renderedItemCount = 0;
		this.renderedItemCountChanged();

		this.owner.owner.blurSearchTextBoxes();

		///---Karthik: Then call getDocumentSearchResults again
		/// Imagine a scenario when the search is processing, and you click the textbox
		/// , enter a new search term and press SEARCH while search is in progress
		/// In this case, you have to cancel the existing search, clear out all the controls
		/// and proceed with new search term
		this.owner.owner.$.reader.$.body.$.krfPlugin.callPluginMethodDeferred(enyo.bind(this, "blank"), "getDocumentSearchResults", searchString, this.numResultsToReturn);
		if (window.PalmSystem == null) {
			this.showSearchResults([
				new SearchResultsData("blah blah blah 1", 101, 2339101), new SearchResultsData("blah blah blah 2", 102, 2339102), new SearchResultsData("blah blah blah 3", 103, 2339103), new SearchResultsData("blah blah blah 4", 104, 2339104), new SearchResultsData("blah blah blah 5", 105, 2339105), new SearchResultsData("blah blah blah 6", 106, 2339106)
			]);
		}
		this.$.searchSpinner.show();
        enyo.keyboard.setManualMode(false);
	},

	blank: function() {},
	
	onSearchScroll: function(inSender) {
		//this.log("onSearchScroll called! position: " + this.$.SearchScroller.getScrollTop());
	},

	onSearchScrollStart: function(inSender) {
		//this.log("onSearchScroll START called! position: " + this.$.SearchScroller.getScrollTop());
	},

	onSearchScrollStop: function(inSender) {
		//this.log("onSearchScroll STOP called! position: " + this.$.SearchScroller.getScrollTop());
	},

	handleSearchItemRendered: function(inSender) {
		this.renderedItemCount++;
		this.renderedItemCountChanged();
		//this.log("Item " + this.renderedItemCount + " rendered");
	},

	getSearchResultsItem: function(inSender, inIndex) {
		return null;
	},

	populateSearchResults: function(result) {
		var jsonResult = JSON.parse(result);
		this.searchResults = [];

		for (var i = 0; i < jsonResult.length; i++) {
			this.log(i);
			this.searchResults.push(new SearchResultsData(jsonResult[i].Sentence, jsonResult[i].Position, jsonResult[i].PositionId));
		}

		if (this.searchResults.length > 0) {
			enyo.asyncMethod(this, "showSearchResults", this.searchResults);
		} else {
			// if no more search results:
            this.log("renderedItemCount has been reset");
			this.renderedItemCount = 0;
			this.renderedItemCountChanged();
			this.$.searchSpinner.hide();
		}
	},
    
	showSearchResults: function(searchResults) {
		var strTmp = new enyo.g11n.Template($L("#{num} results"));
        var strTmp2 = new enyo.g11n.Template($L("#{num} result"));
        if ((searchResults.length + this.listCount) != 1) 
        {
            this.$.searchResultsCount.setContent(strTmp.evaluate({
                num: (searchResults.length + this.listCount)
            }));
        }
        else
        // If there is only one result use 'result' instead of 'results':
        {
            this.$.searchResultsCount.setContent(strTmp2.evaluate({
                num: (searchResults.length + this.listCount)
            }));
        }

		var rg = new RegExp(this.searchString, "gi");
		var replaceString; // this variable maintains the case of the replacement string
		for (var i = 0; i < (searchResults.length); i++) {
			if(this.renderedItemCount < 0)
            {
                this.cleanSearchResults();
                break;
            }
            // TODO: Work-around since searchResults[i].SearchResult seems to have 2 spaces between each word
			//       Need to investigate more and remove this hack... (also remember to remove this.dblSpaceRegex when removing this work-around)
			searchResults[i].SearchResult = searchResults[i].SearchResult.replace(this.dblSpaceRegex, " ");
			// End of Work-around
			var searchResultLoc = searchResults[i].SearchResult.search(rg);
			if (searchResultLoc != -1) {
				replaceString = searchResults[i].SearchResult.substring(searchResultLoc, searchResultLoc + this.searchString.length);
			} else replaceString = this.searchString;

			this.$.SearchResultsList.createComponent({
				owner: this,
				name: "searchResult" + parseInt(i + this.listCount),
				result: "..." + searchResults[i].SearchResult.replace(rg, "<span style=\"background-color: #FFFF00\">" + replaceString + "</span>") + "...",
				location: searchResults[i].location,
				positionId: searchResults[i].positionId,
				kind: "kindle.kindle_panels.SearchResultsItem",
				onSearchResultSelected: "doSearchResultSelected"
			});
            this.$["searchResult" + parseInt(i + this.listCount)].render();
            this.$.searchResultsCount.render();
            
            this.listCount = this.listCount + searchResults.length;
			this.listCountChanged();
            
            this.SearchResultsListRendered();
            
			if (this.listCount % this.numResultsBeforePause == 0) {
				this.$.SearchResultsList.createComponent({
					owner: this,
					name: "searchMoreBtn" + this.listCount,
					btnText: this.listCount + " Results (tap to continue)",
					kind: "kindle.kindle_panels.continueSearchButton",
					onSearchMore: "handleSearchMoreBtnClicked"

				});
				this.$.searchSpinner.hide();
                
                this.$["searchMoreBtn" + this.listCount].render();
			}

		}

		//this.$.SearchResultsList.render();
		//this.$.searchResultsCount.render();
		//this.render();
		//enyo.asyncMethod(this, "render");
	},

	handleSearchMoreBtnClicked: function() {
		console.log("handleSearchMoreBtn CLICKED!");
		this.$["searchMoreBtn" + this.listCount].destroy();
		if(window.PalmSystem) {
			this.owner.owner.$.reader.$.body.$.krfPlugin.callPluginMethod("getDocumentSearchResults", this.searchString, this.numResultsToReturn);
		}
        this.$.searchSpinner.show();
	}

});

enyo.kind({
    name: "kindle.kindle_panels.SearchResultsItem",
    kind: enyo.Item,
    tapHighlight: true,
	className: "list-view-item",
    events: {
        onSearchResultSelected: ""
    },
    components: [
        {kind: "HFlexBox", flex:1, onclick: "searchItemClicked", components: [
            {kind: "Flyweight", style:"color:black;", name: "result", flex: 1, content:""},
            {name: "location", content:""},
			{name: "positionId", content:""}
        ]}
    ],
    
	create: function() {
		this.inherited(arguments);
		this.$.result.content = arguments[0].result;
		this.$.location.setContent(arguments[0].location);
		this.location = arguments[0].location;
		this.positionId = arguments[0].positionId;
	},

	rendered: function() {
		//this.doSearchItemRendered();
	},

    // do not use 'clickHandler' apparently it's a hidden method for 'enyo.item' that
    // automatically fires if an item kind is clicked which results in double event!
	searchItemClicked: function(insender) {
		this.doSearchResultSelected(this.location, this.positionId);
	}
});

enyo.kind({
    name: "kindle.kindle_panels.continueSearchButton",
    kind: enyo.Item,
    tapHighlight: true,
	className: "list-view-item",
    events: {
        onSearchMore: ""
    },
    components: [
            {kind: "Flyweight", style:"color:black;", onclick: "searchItemClicked", name: "searchMoreBtn", flex: 1, content:""}
    ],

	create: function() {
		this.inherited(arguments);
		this.$.searchMoreBtn.setContent(arguments[0].btnText);
	},

	searchItemClicked: function(insender) {
		this.doSearchMore();
	}
});