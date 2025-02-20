/* eslint-disable no-console */

import config from 'config';
import { DateTime } from 'luxon';
import * as migrateMongo from 'migrate-mongo';

import { logger } from './lib/logger';
import * as mongoose from './lib/mongoose';

const rollbackMigrations = async () => {
	logger.silent = process.argv?.[3] !== '--logger';
	logger.info('Started migration rollback...');

	const db = await mongoose.connect();

	migrateMongo.config.set(config.get('migrateMongo'));

	try {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const migrations = await migrateMongo.status(db.admin.connection.db);

		if (process.argv.length < 3) {
			const migrationDates = [
				...new Set(
					migrations
						.map((migration) => migration.appliedAt)
						.filter((appliedAt) => appliedAt !== 'PENDING')
						.map((appliedAt) => DateTime.fromISO(appliedAt).toISODate())
				)
			];
			if (migrationDates.length > 0) {
				console.log('Past migration dates:');
				for (const appliedAt of migrationDates) {
					console.log(appliedAt);
				}
			} else {
				console.log('No migrations found.');
			}
			return;
		}

		const date = DateTime.fromISO(process.argv[2]).toISO();

		let migration = migrations.pop();
		while (migration.appliedAt !== 'PENDING' && migration.appliedAt > date) {
			console.log(`rolling back ${migration.fileName}`);

			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			// eslint-disable-next-line no-await-in-loop
			await migrateMongo.down(db.admin.connection.db);

			migration = migrations.pop();
		}
	} catch (error) {
		logger.error('Execution failed.');
		return Promise.reject(error);
	}
};

rollbackMigrations()
	.then(() => {
		logger.info('Execution complete');
		process.exit(0);
	})
	.catch((error) => {
		logger.error('Startup initialization failed.', error);
		process.exit(1);
	});
