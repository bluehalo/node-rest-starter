import { model, Schema, Types } from 'mongoose';

import getterPlugin from '../../common/mongoose/getter.plugin';

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

export interface ITeamRole {
	_id: Types.ObjectId;
	role: TeamRoles;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     TeamRole:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         role:
 *           type: string
 */
export const TeamRoleSchema = new Schema<ITeamRole>({
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
});

TeamRoleSchema.plugin(getterPlugin);

TeamRoleSchema.virtual('team', {
	ref: 'Team',
	localField: '_id',
	foreignField: '_id',
	justOne: true
});

export const TeamRole = model('TeamRole', TeamRoleSchema);
