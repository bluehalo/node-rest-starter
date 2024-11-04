import config from 'config';
import { HydratedDocument, Model, model, Schema } from 'mongoose';

import {
	ContainsSearchable,
	containsSearchPlugin
} from '../../common/mongoose/contains-search.plugin';
import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	Paginateable,
	paginatePlugin
} from '../../common/mongoose/paginate.plugin';

interface IAudit {
	created: Date;
	message: string;
	audit: {
		auditType: string;
		action: string;
		actor: Record<string, unknown>;
		object: string | Record<string, unknown>;
		userSpec: {
			browser: string;
			os: string;
		};
		masqueradingUser?: string;
	};
}

export type AuditDocument = HydratedDocument<
	IAudit,
	NonNullable<unknown>,
	IAuditQueryHelpers
>;

type IAuditQueryHelpers = ContainsSearchable & Paginateable<AuditDocument>;

export type AuditModel = Model<AuditDocument, IAuditQueryHelpers>;

/**
 * Schema Declaration
 */
const AuditSchema = new Schema<
	IAudit,
	AuditModel,
	NonNullable<unknown>,
	IAuditQueryHelpers
>(
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
		id: false,
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

// created datetime index, expires after configured time (false to disable TTL)
if (config.get('auditExpires') === false) {
	AuditSchema.index({ created: -1 });
} else {
	AuditSchema.index(
		{ created: -1 },
		{ expireAfterSeconds: config.get<number>('auditExpires') }
	);
}

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
export const Audit = model<IAudit, AuditModel>('Audit', AuditSchema, 'audit');
