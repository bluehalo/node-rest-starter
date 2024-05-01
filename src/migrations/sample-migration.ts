import * as mongo from 'mongodb';

import { logger } from '../lib/logger';

export const up = async (db: mongo.Db): Promise<void> => {
	logger.debug('MigrateMongo: Executing migration...');

	// TODO write your migration here.
	// See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
	// Example:
	// await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});
};

export const down = async (db: mongo.Db): Promise<void> => {
	logger.debug('MigrateMongo: Rolling back migration...');

	// TODO write the statements to rollback your migration (if possible)
	// Example:
	// await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
};
