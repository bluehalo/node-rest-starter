'use strict';

const _ = require('lodash'),
	mongoose = require('mongoose'),
	uuid = require('uuid'),
	deps = require('../../../dependencies'),
	util = deps.utilService,
	getterPlugin = require('../../common/mongoose/getter.plugin');

/**
 * Owner Schema
 */

const OwnerSchema = new mongoose.Schema({
	type: {
		type: String,
		default: 'team',
		enum: ['team', 'user', 'system'],
		required: 'Owner type is required'
	},
	_id: {
		type: mongoose.Schema.Types.ObjectId,
		required: 'Owner ID is required'
	},
	name: {
		type: String,
		trim: true
	}
});

OwnerSchema.plugin(getterPlugin);

OwnerSchema.index({ name: 1 });

/**
 * Resource Schema
 */
module.exports.resourceOptions = { discriminatorKey: 'resourceType' };

const ResourceSchema = new mongoose.Schema(
	{
		_id: {
			type: String,
			default: uuid.v4
		},
		title: {
			type: String,
			trim: true,
			required: 'Title is required'
		},
		title_lowercase: {
			type: String,
			set: util.toLowerCase
		},
		description: {
			type: String,
			trim: true,
			default: ''
		},
		created: {
			type: Date,
			default: Date.now,
			get: util.dateParse
		},
		updated: {
			type: Date,
			default: Date.now,
			get: util.dateParse
		},
		tags: [
			{
				type: String,
				trim: true,
				default: []
			}
		],
		creator: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User'
		},
		owner: {
			type: OwnerSchema,
			required: 'Owner is required'
		}
	},
	module.exports.resourceOptions
);

/**
 * Index declarations
 */

ResourceSchema.index({ created: 1, updated: -1 });
ResourceSchema.index({ title_lowercase: 'text', description: 'text' });

/**
 * Lifecycle hooks
 */
ResourceSchema.pre('save', function (next) {
	const resource = this;
	resource.title_lowercase = resource.title;
	next();
});

/**
 * Instance Methods
 */

/**
 * Static Methods
 */

// Create a filtered copy for auditing
ResourceSchema.statics.auditCopy = function (src) {
	/**
	 * @type {Object.<string, any>}
	 */
	const toReturn = {};
	src = src || {};

	toReturn._id = src._id;
	toReturn.creator = src.creator;
	toReturn.title = src.title;
	toReturn.description = src.description;
	toReturn.owner = _.cloneDeep(src.owner);
	toReturn.tags = src.tags;

	return toReturn;
};

ResourceSchema.statics.auditUpdateCopy = function (src) {
	/**
	 * @type {Object.<string, any>}
	 */
	const toReturn = {};
	src = src || {};

	toReturn._id = src._id;
	toReturn.title = src.title;
	toReturn.description = src.description;
	toReturn.owner = _.pick(src.owner, ['_id', 'type']);
	toReturn.tags = src.tags;

	return toReturn;
};

/**
 * Model Registration
 */

mongoose.model('Owner', OwnerSchema);
mongoose.model('Resource', ResourceSchema, 'resources');
