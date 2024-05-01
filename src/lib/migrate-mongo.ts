import config from 'config';
import * as migrateMongo from 'migrate-mongo';
import { Mongoose } from 'mongoose';

import { logger } from './logger';

export const migrate = async (db: Mongoose) => {
	if (config.get<boolean>('migrateMongo.enabled')) {
		logger.info('MigrateMongo: migration enabled');
		migrateMongo.config.set(config.get('migrateMongo'));

		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const migrated = await migrateMongo.up(db.connection.db);
		logger.info(`MigrateMongo: executed ${migrated.length} migration(s)`);
	} else {
		logger.info('MigrateMongo: migration disabled');
	}
};
