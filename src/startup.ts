import http from 'http';

import * as agenda from './lib/agenda';
import { logger } from './lib/bunyan';
import * as express from './lib/express';
import * as mongoose from './lib/mongoose';
import socketio from './lib/socket.io';

export default async function () {
	logger.info('Starting initialization of Node.js server');

	const db = await mongoose.connect();

	try {
		logger.info(
			'Mongoose connected, proceeding with application configuration'
		);

		// Init agenda.ts scheduler
		await agenda.init();

		// Initialize express
		const app = await express.init(db.admin);

		// Create a new HTTP server
		logger.info('Creating HTTP Server');
		const server = http.createServer(app);

		// Initialize socket.io
		await socketio.init(server, db.admin);

		return server;
	} catch (err) {
		logger.fatal('Express initialization failed.');
		return Promise.reject(err);
	}
}
