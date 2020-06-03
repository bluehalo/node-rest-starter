'use strict';

const
	mongoose = require('mongoose'),
	pagingSearchPlugin = require('../../../common/mongoose/paging-search.plugin'),
	deps = require('../../../../dependencies'),
	util = deps.utilService,
	GetterSchema = deps.schemaService.GetterSchema;

/**
 * Schema Declaration
 */
const CacheEntrySchema = new GetterSchema({
	// The external id of this entry
	key: {
		type: String,
		trim: true
	},

	// The actual ts this entry was entered into the cache
	ts: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	},

	// The value of the entry
	value: {},

	// The value of the entry, in string format
	valueString: {
		type: String
	}
});

CacheEntrySchema.plugin(pagingSearchPlugin);


/**
 * Index declarations
 */

CacheEntrySchema.index({ ts: -1 });
CacheEntrySchema.index({ key: 1 });


/**
 * Lifecycle hooks
 */


/**
 * Static Methods
 */

CacheEntrySchema.statics.fullCopy = function(entry) {
	let toReturn = null;

	if(null != entry){
		toReturn = {};

		toReturn._id = entry._id;
		toReturn.key = entry.key;
		toReturn.ts = entry.ts;
		toReturn.value = entry.value;
	}

	return toReturn;
};

/**
 * Register the Schema with Mongoose
 */
mongoose.model('CacheEntry', CacheEntrySchema, 'cache.entry');
