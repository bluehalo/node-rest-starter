import { Static, Type } from '@fastify/type-provider-typebox';
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
import { DateTimeType } from '../core.types';

export const AuditType = Type.Object({
	created: DateTimeType,
	message: Type.String(),
	audit: Type.Object({
		auditType: Type.String(),
		action: Type.String(),
		actor: Type.Record(Type.String(), Type.Unknown()),
		object: Type.Optional(
			Type.Union([Type.String(), Type.Record(Type.String(), Type.Unknown())])
		),
		userSpec: Type.Object({
			browser: Type.String(),
			os: Type.String()
		}),
		masqueradingUser: Type.Optional(Type.String())
	})
});

type IAudit = Static<typeof AuditType>;

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
