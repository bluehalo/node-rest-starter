'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	paginatePlugin = require('../../common/mongoose/paginate.plugin'),
	containsSearchPlugin = require('../../common/mongoose/contains-search.plugin'),
	deps = require('../../../dependencies'),
	util = deps.utilService;

/**
 * Schema Declaration
 */
const AuditSchema = new mongoose.Schema({
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
			interfaceUrl: { type: String },
			object: { type: String },
			userSpec: {
				type: {
					browser: { type: String },
					os: { type: String }
				}
			}
		}
	}
});

AuditSchema.plugin(getterPlugin);
AuditSchema.plugin(paginatePlugin);
AuditSchema.plugin(containsSearchPlugin, {
	fields: ['message', 'audit.auditType', 'audit.action', 'audit.object']
});

/**
 * Index declarations
 */

// Created datetime index, expires after 180 days
AuditSchema.index({ created: -1 }, { expireAfterSeconds: 15552000 });

// Audit Type index
AuditSchema.index({ 'audit.auditType': 1 });

// Audit Action index
AuditSchema.index({ 'audit.action': 1 });

// User index
AuditSchema.index({ 'audit.actor': 1 });

// Audit object index
AuditSchema.index({ 'audit.object': 1 });

// Audit message index
AuditSchema.index({ message: 1 });

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
