import { models } from 'mongoose';

import { logger } from './lib/logger';
import * as mongoose from './lib/mongoose';

const syncIndex = async () => {
	logger.info('Started index sync...');

	await mongoose.connect();

	try {
		logger.info('Mongoose connected, proceeding with index sync');

		for (const model of Object.values(models)) {
			logger.info(`syncing indexes for model: ${model.modelName} `);
			// eslint-disable-next-line no-await-in-loop
			await model.syncIndexes();
		}
	} catch (error) {
		logger.error('failed.');
		return Promise.reject(error);
	}
};

syncIndex()
	.then(() => {
		logger.info('Index sync complete');
		process.exit(0);
	})
	.catch((error) => {
		logger.error('Startup initialization failed.', error);
		process.exit(1);
	});
