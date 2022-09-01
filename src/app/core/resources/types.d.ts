import { Document, Model } from 'mongoose';

interface IResource extends Document {
	_id: string;
	title: string;
	title_lowercase: string;
	description: string;
	created: Date;
	updated: Date;
	tags: string[];
}

export type ResourceDocument = IResource;

export type ResourceModel = Model<ResourceDocument>;
