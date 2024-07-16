import mongoose, {
	model,
	HydratedDocument,
	Model,
	Schema,
	Types
} from 'mongoose';

import { utilService } from '../../../dependencies';
import {
	ContainsSearchable,
	containsSearchPlugin
} from '../../common/mongoose/contains-search.plugin';
import getterPlugin from '../../common/mongoose/getter.plugin';
import {
	Paginateable,
	paginatePlugin
} from '../../common/mongoose/paginate.plugin';
import { UserDocument } from '../user/user.model';

export interface ITeam {
	name: string;
	description: string;
	created: Date;
	updated: Date;
	creator: Types.ObjectId;
	creatorName: string;
	implicitMembers: boolean;
	requiresExternalRoles: string[];
	requiresExternalTeams: string[];
	parent: Types.ObjectId;
	ancestors: Types.ObjectId[];
}

export interface ITeamMethods {
	auditCopy(): Record<string, unknown>;
	auditCopyTeamMember(user: UserDocument): Record<string, unknown>;
}

export type TeamDocument = HydratedDocument<
	ITeam,
	ITeamMethods,
	ITeamQueryHelpers
>;

type ITeamQueryHelpers = ContainsSearchable & Paginateable<TeamDocument>;

export type TeamModel = Model<ITeam, ITeamQueryHelpers, ITeamMethods>;

const TeamSchema = new Schema<
	ITeam,
	TeamModel,
	ITeamMethods,
	ITeamQueryHelpers
>(
	{
		name: {
			type: String,
			trim: true,
			default: '',
			validate: [utilService.validateNonEmpty, 'Please provide a team name']
		},
		description: {
			type: String,
			trim: true
		},
		creator: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			immutable: true
		},
		creatorName: {
			type: String,
			immutable: true
		},
		implicitMembers: {
			type: Boolean,
			default: false
		},
		requiresExternalRoles: {
			type: [String]
		},
		requiresExternalTeams: {
			type: [String]
		},
		parent: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Team'
		},
		ancestors: {
			type: [
				{
					type: mongoose.Schema.Types.ObjectId,
					ref: 'Team'
				}
			]
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: 'updated'
		}
	}
);
TeamSchema.plugin(getterPlugin);
TeamSchema.plugin(paginatePlugin);
TeamSchema.plugin(containsSearchPlugin, {
	fields: ['name', 'description']
});

/**
 * Index declarations
 */
TeamSchema.index({ name: 1 });
TeamSchema.index({ description: 1 });
TeamSchema.index({ created: 1 });

/**
 * Lifecycle Hooks
 */

/**
 * Instance Methods
 */

/**
 * Static Methods
 */
// Copy a team for audit logging
TeamSchema.methods.auditCopy = function (): Record<string, unknown> {
	const team: Record<string, unknown> = {};
	team._id = this._id;
	team.name = this.name;
	team.description = this.description;

	return team;
};

// Copy a team role for audit logging
TeamSchema.methods.auditCopyTeamMember = function (
	user: UserDocument,
	role = null
): Record<string, unknown> {
	const toReturn: Record<string, unknown> = {};

	toReturn.user = {
		_id: user._id,
		name: user.name,
		username: user.username
	};

	toReturn.team = {
		_id: this._id,
		name: this.name
	};

	toReturn.role = role;

	return toReturn;
};

export const Team = model<ITeam, TeamModel>('Team', TeamSchema, 'teams');
