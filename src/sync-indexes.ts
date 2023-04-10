import { models } from 'mongoose';

import { logger } from './lib/bunyan';
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
	} catch (err) {
		logger.fatal('failed.');
		return Promise.reject(err);
	}
};

syncIndex()
	.then(() => {
		logger.info('Index sync complete');
		process.exit(0);
	})
	.catch((error) => {
		logger.fatal(error, 'Startup initialization failed.');
		process.exit(1);
	});
