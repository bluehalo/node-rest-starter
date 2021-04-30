import {
	Document,
	Model,
	model,
	Types,
	Schema,
	Query,
	Mongoose
} from 'mongoose';
import { BinaryLike } from 'crypto';

interface IResource extends Document {
	_id: string;
	title: string;
	title_lowercase: string;
	description: string;
	created: Date;
	updated: Date;
	tags: string[];
}

export interface ResourceDocument extends IResource {}

export interface ResourceModel extends Model<ResourceDocument> {}
