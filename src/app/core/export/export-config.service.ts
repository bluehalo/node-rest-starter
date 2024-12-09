import { Types } from 'mongoose';

import {
	ExportConfig,
	ExportConfigDocument,
	ExportConfigModel,
	IExportConfig
} from './export-config.model';

class ExportConfigService {
	constructor(private model: ExportConfigModel) {}

	/**
	 * Generate a new ExportConfig document in the collection.
	 */
	create(doc: Partial<IExportConfig>): Promise<ExportConfigDocument> {
		const exportConfig = new this.model(doc);
		return exportConfig.save();
	}

	/**
	 * Finds the requested export config from the collection.
	 */
	read(exportId: string | Types.ObjectId): Promise<ExportConfigDocument> {
		return this.model.findById(exportId).exec();
	}
}

export = new ExportConfigService(ExportConfig);
