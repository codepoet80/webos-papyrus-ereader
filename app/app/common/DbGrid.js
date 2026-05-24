/*
 *  DbGrid.js
 *
 *  © Copyright 2011 Hewlett-Packard Development Company, L.P. All rights reserved.
 *  The code in this file is included in the Kindle App for webOS under an “HP Owned Limited License”
 *
 */
enyo.kind({
	name: "DbGrid",
	kind: enyo.DbList,
	published: {
		columnCount: 4, // number of columns in each row
	},
	events: {
		/**
		Fires when a cell of a row is rendered.  Similar to 'onSetupRow' in a DbList,
		which this event replaces ('onSetupRow' is never triggered).  Slightly different
		is that the handler returns true if it wants the grid-cell is to be shown, 
		and false otherwise.
		
		inRecord {Object} Object containing row data.
		
		rowIndex {Integer} Index of the row that the cell belongs to.
		
		columnIndex {Integer} Index of the cell within the row.
		
		flyweight {Object} Flyweight created by object-spec in columnCountChanged().
		*/
		onSetupCell: "",
		
		/**
		Fires when a cell is clicked on.
		
		inRecord {Object} Object containing row data.

		rowIndex {Integer} Index of the row that the cell belongs to.

		columnIndex {Integer} Index of the cell within the row.
		*/
		onCellClick: "",
		
		onCellMouseHold: "",
		onCellMouseRelease: "",
		onCellDragStart: "",
		onCellDrag: "",
		onCellDragFinish: "",
		
		/**
		Called when generating the flyweight content for a cell.  The owner should respond
		with a enyo object-spec that will be used to generate the flyweight.  
		*/
		onCreateCell: ""
	},
	components: [
		{kind: "DbPages", onQuery: "doQuery"},
		{flex: 1, name: "list", kind: "VirtualList", onSetupRow: "setupRow", onAcquirePage: "acquirePage", onDiscardPage: "discardPage", components: [
			// XXXXX Want to explore more layout options, like Tim Caswell's HLayout
//			{name: "cells", kind: "HFlexBox" }
			{name: "cells", style: "display: -webkit-box; -webkit-box-align: stretch; -webkit-box-pack: justify; -webkit-box-orient: horizontal;" }
		]}
	],
	create: function() {
		this.inherited(arguments);
		this.columnCountChanged();
		
		// XXXXX This should probably be the default for vertically-scrolling VirtualLists...
		// if that happens, this code should be removed.
		this.$.list.$.scroller.setHorizontal(false);
	},
	pageSizeChanged: function() {
		this.$.list.pageSize = this.pageSize;
		this.$.dbPages.size = this.pageSize * this.columnCount;
	},
	// TODO: allow number of columns to change dynamically.  I believe that
	//       trouble will result from messing with this.$.dbPages.size if 
	//       the db-pages already have data, and I'm not addressing this.
	columnCountChanged: function(oldColumnCount) {
		if (this.columnCount === oldColumnCount) return; // no change
		
		// See TODO above... don't want people to experience weird and
		// undefined behavior by accidentally changing the column count
		// on the fly.	
		if (oldColumnCount) {
			throw new Error("cannot change column-count");
		}
		
		// In my understanding, the list's page-size is the number of rows per page.
		// For the db-cache page-size, we multiply by the number of columns.  The
		// intention is for pages in the list and in the db-cache to each correspond
		// to the specified number of rows in the list.
		this.$.dbPages.size = this.pageSize * this.columnCount;
		
		// Create a cell for each column.
		this.$.cells.destroyControls();
		this.cells = [];

		// Sometimes the user doesn't want event-handling to happen on the
		// outermost cell-control.  They can use the 'manualEventHandlerSetup'
		// property to do themselves.  In this case, they are responsible for
		// doing the following to each sub-control that they want to handle
		// events:
		//   - setting the 'idx' property
		//   - setting up onclick/onmousehold/etc. handlers for each
		//     event to be handled.  The handlers must use the correct
		//     handler-name (eg: cellClick/cellMouseHold/etc.)
		var mixin;
		if (this.manualEventHandlerSetup) { mixin = { owner: this } }
		else {
			mixin = {
				owner: this,
				onclick: "cellClick",
				onmousehold: "cellMouseHold",
				onmouserelease: "cellMouseRelease",
				ondragstart: "cellDragStart",
				ondrag: "cellDrag",
				ondragfinish: "cellDragFinish"
			}
		}

		for (var i=0; i<this.columnCount; i++) {
			mixin.idx = i;
			var spec = this.doCreateCell(i);			
			if (!spec) {
				// If our owner didn't generate a flyweight-spec, then generate our own placeholder.
				spec = {name: "cellFlyweight", contents: 'CELL', style: 'height: 50px; width: 100px; background-color: yellow', idx: i};
			}			
			
			var c = this.$.cells.createComponent(spec, mixin);
			this.cells.push(c);
		}
	},
	// Identical to superclass implementation, but with argument renamed 
	// to emphasize new semantics... we're retrieving the db-entry for 
	// a the cell at a particular row/column.
	fetch: function(inCellIdx) {
		return this.$.dbPages.fetch(inCellIdx);
	},
	setupRow: function(inSender, inIndex) {
//			console.log("SETTING UP ROW " + inIndex );

			var idx = inIndex * this.columnCount;
			var pages = this.$.dbPages;
			var showRow = false;
			for (var i=0, cell; cell=this.cells[i]; i++, idx++) {
				var entry = pages.fetch(idx);
				if (!entry) {
//					console.log("no entry found for index: " + idx);
					cell.applyStyle("visibility", "hidden");
				}
				else {
					var showCell = this.doSetupCell(entry, inIndex, i, cell);
					if (showCell) {
						cell.applyStyle("visibility", "visible");
						showRow = true;
					}
					else { cell.applyStyle("visibility", "hidden"); }
				}
			}
			// Did we display any items at all?
			this.$.cells.canGenerate = showRow;
			return showRow;
	}, 
	signalCellEvent: function(eventName, inSender, inEvent, inRowIndex) {
		var idx = inEvent.rowIndex * this.columnCount + inSender.idx;
		var entry = this.$.dbPages.fetch(idx);
		if (!entry) {
			// Just for debugging.
			console.log("WARN: No db-entry found for " + eventName + " on cell(" + inSender.idx + "," + inEvent.rowIndex + ")");
			return false;
		}
		return this["doCell" + eventName].call(this, inSender, inEvent.rowIndex, inSender.idx, entry, inEvent);
	},
	cellClick: function(inSender, inEvent) {
		return this.signalCellEvent("Click", inSender, inEvent);
	},
	cellMouseHold: function(inSender, inEvent) {
		return this.signalCellEvent("MouseHold", inSender, inEvent);
	},
	cellMouseRelease: function(inSender, inEvent) {
		return this.signalCellEvent("MouseRelease", inSender, inEvent);
	},
	cellDragStart: function(inSender, inEvent) {
		return this.signalCellEvent("DragStart", inSender, inEvent);
	},
	cellDrag: function(inSender, inEvent) {
		return this.signalCellEvent("Drag", inSender, inEvent);
	},
	cellDragFinish: function(inSender, inEvent) {
		return this.signalCellEvent("DragFinish", inSender, inEvent);
	},
	
/*	
	onCellClick: "",
	onCellMouseHold: "",
	onCellMouseRelease: "",
	onCellDragStart: "",
	onCellDrag: "",
	onCellDragFinish: "",
*/
	multiModeChange: function(inSender) {
//		this.$.selection.setMulti(inSender.getState());
		this.$.list.refresh();
	},
});