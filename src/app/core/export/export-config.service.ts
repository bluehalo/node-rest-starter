import { Types } from 'mongoose';

import { dbs } from '../../../dependencies';
import { ExportConfigDocument, ExportConfigModel } from './export-config.model';

class ExportConfigService {
	model = dbs.admin.model('ExportConfig') as ExportConfigModel;

	/**
	 * Generate a new ExportConfig document in the collection.
	 */
	create(doc: unknown): Promise<ExportConfigDocument> {
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

export = new ExportConfigService();
