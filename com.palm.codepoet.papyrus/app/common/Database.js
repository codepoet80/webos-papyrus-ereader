kindle.database = function(){
	//Book Metadata (Library) constants
	this.MetadataKind="com.palm.kindle.books:1";
	
	this.PutKindMetaDataParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
			{"name":"asinguid","props":[{"name":"asin"},{"name":"guid"},{"name":"type"}]},
			{"name":"asintype","props":[{"name":"asin"},{"name":"type"}]},
			{"name":"isdeletedasinguid","props":[{"name":"isDeleted"},{"name":"asin"},{"name":"guid"},{"name":"type"}]},
			{"name":"guidasin","props":[{"name":"guid"},{"name":"asin"}]},
			{"name":"isDeletedDownloadProgress","props":[{"name":"isArchived"},{"name":"downloadProgress"},{"name":"titleIndex", "collate": "primary"}]},
			// sorts
			{"name":"isDeletedauthorIndex","props":[{"name":"isDeleted","default":"0"},{"name":"authorIndex", "collate": "primary"}]},
			{"name":"isDeletedtitleIndex","props":[{"name":"isDeleted","default":"0"},{"name":"titleIndex", "collate": "primary"}]},
			{"name":"isDeletedlastAccessed","props":[{"name":"isDeleted","default":"0"},{"name":"lastAccessed"}]},
			// categories + sorts
			{"name":"categoriestitle","props":[{"name":"isDeleted","default":"0"},{"name":"categories"},{"name":"titleIndex", "collate": "primary"}]},
			{"name":"categoriesauthor","props":[{"name":"isDeleted","default":"0"},{"name":"categories"},{"name":"authorIndex", "collate": "primary"}]},
			{"name":"categorieslastAccessed","props":[{"name":"isDeleted","default":"0"},{"name":"categories"},{"name":"lastAccessed"}]},
			// archived + sorts
			{"name":"isArchivedtitle","props":[{"name":"isDeleted","default":"0"},{"name":"isArchived"},{"name":"titleIndex", "collate": "primary"}]},
			{"name":"isArchivedauthor","props":[{"name":"isDeleted","default":"0"},{"name":"isArchived"},{"name":"authorIndex", "collate": "primary"}]},
			{"name":"isArchivedlastAccessed","props":[{"name":"isDeleted","default":"0"},{"name":"isArchived"},{"name":"lastAccessed"}]},
			// categories + archived + sorts
			{"name":"categoriestitleisArchived","props":[{"name":"isDeleted","default":"0"},{"name":"categories"}, {"name":"isArchived"},{"name":"titleIndex", "collate": "primary"}]},
			{"name":"categoriesauthorisArchived","props":[{"name":"isDeleted","default":"0"},{"name":"categories"}, {"name":"isArchived"},{"name":"authorIndex", "collate": "primary"}]},
			{"name":"categorieslastAccessedisArchived","props":[{"name":"isDeleted","default":"0"},{"name":"categories"}, {"name":"isArchived"},{"name":"lastAccessed"}]},

			// all above + search
			{"name":"searchTitle","props":[{"name":"isDeleted","default":"0"},{"name":"searchText","type":"multi","collate":"primary","include":[{"name":"title","tokenize":"default"},{"name":"author","tokenize":"all"}]}]},
		]
	};
	
	this.PutKindMarkupsParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
			{"name":"ASIN","props":[{"name":"ASIN"}]},
			{"name":"type","props":[{"name":"type"}]},
			{"name":"startLocation","props":[{"name":"startLocation"}]},
			{"name":"endLocation","props":[{"name":"endLocation"}]}
		]
	};
	
	this.PutKindCategoriesParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
			{"name":"isDeleted","props":[{"name":"isDeleted"}]},
			{"name":"isDeletednameSort","props":[{"name":"isDeleted"},{"name":"collectionName"}]},
			{"name":"isDeletedkeySort","props":[{"name":"isDeleted"},{"name":"sortKey"}]},
			{"name":"isDeletedkeySort2","props":[{"name":"sortKey"},{"name":"isDeleted"}]},
			{"name":"keySort","props":[{"name":"sortKey"}]},
			{"name":"nameSort","props":[{"name":"collectionName"}]},
			{"name":"getbyid","props":[{"name":"collectionId"}]}
		]
	};
	
    this.PutKindReadingPositionsParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
			{"name":"contentIdentifierguid","props":[{"name":"contentIdentifier"},{"name":"contentGuid"},{"name":"contentType"}]},
			{"name":"guidcontentIdentifier","props":[{"name":"contentGuid"},{"name":"contentIdentifier"},{"name":"contentType"}]}
		]
	};
    
    this.PutKindMetricsParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
			{"name":"eventId","props":[{"name":"eventId"}]},
			{"name":"timestamp","props":[{"name":"timestamp"}]},
            {"name":"component","props":[{"name":"component"}]},
			{"name":"componentTimeSort","props":[{"name":"component"},{"name":"timestamp"}]},

		]
	};
    
    this.PutKindConfigDataParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
			{"name":"key","props":[{"name":"key"}]},
		]
	};
    
	this.QueryAllMeta = function(){
		var param = {
			"query": {
				"from": this.MetadataKind
			}
		};
		return param;
	};
	
	this.whereCategoryQuery = function (inCategory) {
	    var param = {
			"query": {
				"from": this.MetadataKind,
				"where": [{
					"prop": "categories",
					"op": "=",
					"val": inCategory
				}]
			}
		}
		return param;
	};
	
	this.whereAuthorQuery = function (inAuthor) {
	    var param = {
			"query": {
				"from": this.MetadataKind,
				"where": [{
					"prop": "author",
					"op": "=",
					"val": inAuthor
				}]
			}
		};
		return param;
	};
	
	//Markups and Annotation constants
	this.MarkupsKind = "com.palm.kindle.markup:1";
	
	this.PutKindMarkupsParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
			{"name":"ASIN","props":[{"name":"ASIN"}]},
			{"name":"type","props":[{"name":"type"}]},
			{"name":"startLocation","props":[{"name":"startLocation"}]},
			{"name":"endLocation","props":[{"name":"endLocation"}]}
		]
	};
	
	this.PutKindJournalParam = {"owner": "com.palm.app.kindle",
    "indexes":[
            {"name":"contentIdentifier","props":[{"name":"contentIdentifier"}]},
            {"name":"oldAnnotationId","props":[{"name":"oldAnnotationId"}]},
            {"name":"newAnnotationId","props":[{"name":"newAnnotationId"}]}]
            
    };
	
	this.PutKindAnnotationsParam = {
		"owner": "com.palm.app.kindle",
		"indexes":[
            {"name":"contentIdentifier","props":[{"name":"contentIdentifier"}]},
			{"name":"isDeletedstartcontentGuid","props":[{"name":"isDeleted"}, {"name":"contentGuid"}, {"name":"start"}]},
			{"name":"isDeletedstartcontentGuidcontentIdentifier","props":[{"name":"isDeleted"}, {"name":"contentIdentifier"}, {"name":"contentGuid"}, {"name":"start"}]},
			{"name":"annotationTypeisDeletedcontentGuidcontentIdentifier","props":[{"name":"annotationType"},{"name":"isDeleted"}, {"name":"contentIdentifier"}, {"name":"contentGuid"}]},
			{"name":"annotationId","props":[{"name":"annotationId"}]},
			{"name":"start","props":[{"name":"start"}]},
			{"name":"contentGuid","props":[{"name":"contentGuid"}]},
			{"name":"isDeleted","props":[{"name":"isDeleted"}]},
            {"name":"sentenceText", "props":[{"name":"sentenceText"}]},
            {"name":"contentGuidcontentIdentifier", "props":[{"name":"contentGuid"}, {"name":"contentIdentifier"}]}
		]
	};
}
