import { HydratedDocument, Model, Types } from 'mongoose';

interface IResource {
	_id: string;
	owner: { type: 'user' | 'team'; name: string; _id: Types.ObjectId };
	title: string;
	title_lowercase: string;
	description: string;
	creator: Types.ObjectId;
	created: Date;
	updated: Date;
	tags: string[];
}

export type ResourceDocument = HydratedDocument<IResource>;

export type ResourceModel = Model<ResourceDocument>;
