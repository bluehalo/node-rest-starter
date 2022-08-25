import { Document, Model, Types as MongooseTypes } from 'mongoose';
import {
	ContainsSearchPlugin,
	TextSearchPlugin
} from '../../common/mongoose/types';

interface ITeam extends Document {
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

export interface TeamDocument extends ITeam {}

type QueryHelpers<T> = ContainsSearchPlugin & PaginatePlugin<T>;

export interface TeamModel
	extends Model<TeamDocument, QueryHelpers<TeamDocument>> {
	auditCopy(team: Object): Object;
}
