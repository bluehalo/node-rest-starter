import { HydratedDocument, Model, Types as MongooseTypes } from 'mongoose';
import { ContainsSearchPlugin } from '../../common/mongoose/types';

interface ITeam {
	name: string;
	description: string;
	created: Date | number;
	updated: Date | number;
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
	extends Model<
		TeamDocument,
		ContainsSearchPlugin & PaginatePlugin<TeamDocument>
	> {
	auditCopy(team: Record<string, unknown>): Record<string, unknown>;
}
