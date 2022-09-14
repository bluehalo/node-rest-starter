'use strict';

const mongoose = require('mongoose'),
	getterPlugin = require('../../common/mongoose/getter.plugin'),
	paginatePlugin = require('../../common/mongoose/paginate.plugin'),
	containsSearchPlugin = require('../../common/mongoose/contains-search.plugin');

/**
 * Import types for reference below
 * @typedef {import('./types').AuditDocument} AuditDocument
 * @typedef {import('./types').AuditModel} AuditModel
 */

/**
 * Schema Declaration
 *
 * @type {mongoose.Schema<AuditDocument, AuditModel>}
 */
const AuditSchema = new mongoose.Schema(
	{
		message: { type: String },
		audit: {
			auditType: { type: String },
			action: { type: String },
			actor: { type: Object },
			object: { type: mongoose.Schema.Types.Mixed },
			userSpec: {
				browser: { type: String },
				os: { type: String }
			},
			masqueradingUser: { type: String }
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: false
		}
	}
);

AuditSchema.plugin(getterPlugin);
AuditSchema.plugin(paginatePlugin);
AuditSchema.plugin(containsSearchPlugin, {
	fields: ['message', 'audit.auditType', 'audit.action']
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

// actor._id index
AuditSchema.index({ 'audit.actor._id': 1 });

// actor.name index
AuditSchema.index({ 'audit.actor.name': 1 });

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
/**
 *
 * @type {import('./types').AuditModel}
 */
const Audit = mongoose.model('Audit', AuditSchema, 'audit');

module.exports = Audit;
