import http from 'http';

import agenda from './lib/agenda';
import { logger } from './lib/bunyan';
import express from './lib/express';
import mongoose from './lib/mongoose';
import socketio from './lib/socket.io';

export default async function () {
	logger.info('Starting initialization of Node.js server');

	const db = await mongoose.connect();

	try {
		logger.info(
			'Mongoose connected, proceeding with application configuration'
		);

		// Init agenda.js scheduler
		agenda.init();

		// Initialize express
		const app = express.init(db.admin);

		// Create a new HTTP server
		logger.info('Creating HTTP Server');
		const server = http.createServer(app);

		// Initialize socket.io
		socketio.init(server, db.admin);

		// Init task scheduler
		const scheduler = await import('./scheduler');
		scheduler.start();

		// Init dispatcher
		const dispatcher = await import('./dispatcher');
		dispatcher.start();

		return server;
	} catch (err) {
		logger.fatal('Express initialization failed.');
		return Promise.reject(err);
	}
}
