import { HydratedDocument, Model, Types as MongooseTypes } from 'mongoose';
import { ContainsSearchable } from '../../common/mongoose/contains-search.plugin';
import { Paginateable } from '../../common/mongoose/paginate.plugin';

export interface ITeam {
	name: string;
	description: string;
	created: Date;
	updated: Date;
	creator: MongooseTypes.ObjectId;
	creatorName: string;
	implicitMembers: boolean;
	requiresExternalRoles: string[];
	requiresExternalTeams: string[];
	parent: MongooseTypes.ObjectId;
	ancestors: MongooseTypes.ObjectId[];
}

export type TeamDocument = HydratedDocument<ITeam>;

export interface TeamModel
	extends Model<ITeam, ContainsSearchable & Paginateable<TeamDocument>> {
	auditCopy(team: Record<string, unknown>): Record<string, unknown>;
}
