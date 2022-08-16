'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../../common/mongoose/getter.plugin'),
	paginatePlugin = require('../../../common/mongoose/paginate.plugin'),
	containsSearchPlugin = require('../../../common/mongoose/contains-search.plugin'),
	deps = require('../../../../dependencies'),
	util = deps.utilService;

/**
 * Schema Declaration
 */
const CacheEntrySchema = new mongoose.Schema({
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

CacheEntrySchema.plugin(getterPlugin);
CacheEntrySchema.plugin(paginatePlugin);
CacheEntrySchema.plugin(containsSearchPlugin, {
	fields: ['key', 'valueString']
});

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

CacheEntrySchema.statics.fullCopy = function (entry) {
	/**
	 * @type {Object.<string, any>}
	 */
	let toReturn = null;

	if (null != entry) {
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
