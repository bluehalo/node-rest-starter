import { model, Schema } from 'mongoose';

import { containsSearchPlugin } from '../../common/mongoose/contains-search.plugin';
import getterPlugin from '../../common/mongoose/getter.plugin';
import { paginatePlugin } from '../../common/mongoose/paginate.plugin';
import { AuditDocument, AuditModel } from './types';

/**
 * Schema Declaration
 */
const AuditSchema = new Schema<AuditDocument, AuditModel>(
	{
		message: { type: String },
		audit: {
			auditType: { type: String },
			action: { type: String },
			actor: { type: Object },
			object: { type: Schema.Types.Mixed },
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
const Audit = model('Audit', AuditSchema, 'audit');

module.exports = Audit;
