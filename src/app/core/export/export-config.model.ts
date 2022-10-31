import _ from 'lodash';
import { HydratedDocument, Model, Schema, Types, model } from 'mongoose';

export type ExportColumnDef = {
	key: string;
	title: string;
	callback: (value: unknown, obj: unknown) => string;
};

export interface IExportConfig {
	_id: Types.ObjectId;
	type: string;
	config: {
		cols: ExportColumnDef[];
		q: string;
		s: string;
		sort: string;
		dir: 'ASC' | 'DESC' | 1 | -1;
	};
	created: Date;
}

export interface IExportConfigMethods {
	auditCopy(): Record<string, unknown>;
}

export type ExportConfigDocument = HydratedDocument<
	IExportConfig,
	IExportConfigMethods
>;

export type ExportConfigModel = Model<
	IExportConfig,
	Record<string, never>,
	IExportConfigMethods
>;

const ExportConfigSchema = new Schema<
	IExportConfig,
	ExportConfigModel,
	IExportConfigMethods
>(
	{
		type: {
			type: String,
			trim: true,
			default: '',
			required: [true, 'Type is required']
		},
		config: {
			type: {},
			required: [true, 'Configuration is required']
		}
	},
	{
		timestamps: {
			createdAt: 'created',
			updatedAt: false
		}
	}
);

/**
 * Index declarations
 */
ExportConfigSchema.index({ created: -1 }, { expireAfterSeconds: 300 });

ExportConfigSchema.methods.auditCopy = function () {
	const toReturn: Record<string, unknown> = {};
	toReturn._id = this._id;
	toReturn.type = this.type;
	toReturn.config = _.cloneDeep(this.config);

	return toReturn;
};

/**
 * Model Registration
 */
export const Message = model<IExportConfig, ExportConfigModel>(
	'ExportConfig',
	ExportConfigSchema
);
