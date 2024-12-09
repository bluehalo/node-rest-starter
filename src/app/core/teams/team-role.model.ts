import { Static, Type } from '@fastify/type-provider-typebox';
import { model, Schema } from 'mongoose';

import getterPlugin from '../../common/mongoose/getter.plugin';
import { ObjectIdType } from '../core.types';

export enum TeamRoles {
	Admin = 'admin',
	Editor = 'editor',
	Member = 'member',
	Requester = 'requester',
	Viewer = 'viewer',
	Blocked = 'blocked'
}

export const TeamRolePriorities = {
	[TeamRoles.Admin]: 7,
	[TeamRoles.Editor]: 5,
	[TeamRoles.Member]: 3,
	[TeamRoles.Viewer]: 1,
	[TeamRoles.Requester]: 0,
	[TeamRoles.Blocked]: -1
};

/**
 * Minimum Team Role needed for access to a team. Used for building filters.
 */
export const TeamRoleMinimumWithAccess = TeamRoles.Member;

/**
 * Team Role that is assigned to Implicit members
 */
export const TeamRoleImplicit = TeamRoles.Member;

export const TeamRoleType = Type.Object({
	_id: ObjectIdType,
	role: Type.Enum(TeamRoles)
});

export type ITeamRole = Static<typeof TeamRoleType>;

export const TeamRoleSchema = new Schema<ITeamRole>(
	{
		_id: {
			type: Schema.Types.ObjectId,
			ref: 'Team'
		},
		role: {
			type: String,
			trim: true,
			default: TeamRoles.Member,
			enum: TeamRoles
		}
	},
	{ id: false }
);

TeamRoleSchema.plugin(getterPlugin);

TeamRoleSchema.virtual('team', {
	ref: 'Team',
	localField: '_id',
	foreignField: '_id',
	justOne: true
});

export const TeamRole = model('TeamRole', TeamRoleSchema);
