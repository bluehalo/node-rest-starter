import { model, Schema, Types } from 'mongoose';

export enum TeamRoles {
	Admin = 'admin',
	Editor = 'editor',
	Member = 'member',
	Requester = 'requester',
	Blocked = 'blocked'
}

export const TeamRolePriorities = {
	[TeamRoles.Admin]: 7,
	[TeamRoles.Editor]: 5,
	[TeamRoles.Member]: 1,
	[TeamRoles.Requester]: 0,
	[TeamRoles.Blocked]: -1
};

export interface ITeamRole {
	_id: Types.ObjectId;
	role: string;
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

export const TeamRole = model<ITeamRole>('TeamRole', TeamRoleSchema);