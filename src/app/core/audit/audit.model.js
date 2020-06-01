'use strict';

const
	mongoose = require('mongoose'),
	pagingSearchPlugin = require('../../common/mongoose/paging-search.plugin'),
	deps = require('../../../dependencies'),
	util = deps.utilService,

	GetterSchema = deps.schemaService.GetterSchema;

/**
 * Schema Declaration
 */
const AuditSchema = new GetterSchema({
	created: {
		type: Date,
		default: Date.now,
		get: util.dateParse
	},
	message: { type: String },
	audit: {
		type: {
			auditType: { type: String },
			action: { type: String },
			actor: { type: String },
			interfaceUrl: {type: String},
			object: { type: String },
			userSpec: {
				type: {
					browser: {type: String},
					os: {type: String}
				}
			}
		}
	}
});

AuditSchema.plugin(pagingSearchPlugin);

/**
 * Index declarations
 */

// Created datetime index, expires after 180 days
AuditSchema.index({ 'created': -1 }, { expireAfterSeconds: 15552000 });

// Audit Type index
AuditSchema.index({ 'audit.auditType': 'text' });

// User index
AuditSchema.index({ 'audit.actor': 'text' });

// Text-search index
AuditSchema.index({ 'message': 'text', 'audit.auditType': 'text', 'audit.action': 'text', 'audit.object': 'text' });

/*****************
 * Lifecycle hooks
 *****************/


/*****************
 * Static Methods
 *****************/

/**
 * Register the Schema with Mongoose
 */
mongoose.model('Audit', AuditSchema, 'audit');
