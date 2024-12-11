import { Mongoose } from 'mongoose';

import * as agenda from './lib/agenda';
import * as fastify from './lib/fastify';
import { logger } from './lib/logger';
import * as migrate_mongo from './lib/migrate-mongo';
import * as mongoose from './lib/mongoose';
import socketio from './lib/socket.io';

export default async function () {
	logger.info('Starting initialization of Node.js server');

	// Init mongoose connection(s)
	const db = await mongoose.connect();

	// Run any required mongo migrations
	await migrate_mongo.migrate(db.admin as Mongoose);

	// Init agenda.ts scheduler
	await agenda.init();

	const app = await fastify.init(db.admin as Mongoose);

	// Initialize socket.io
	await socketio.init(app.server, db.admin as Mongoose);

	return app;
}
