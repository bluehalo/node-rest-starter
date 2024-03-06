import http from 'http';

import { Mongoose } from 'mongoose';

import * as agenda from './lib/agenda';
import * as express from './lib/express';
import { logger } from './lib/logger';
import * as mongoose from './lib/mongoose';
import socketio from './lib/socket.io';

export default async function () {
	logger.info('Starting initialization of Node.js server');

	// Init mongoose connection(s)
	const db = await mongoose.connect();

	// Init agenda.ts scheduler
	await agenda.init();

	// Initialize express
	const app = await express.init(db.admin as Mongoose);

	// Create a new HTTP server
	logger.info('Creating HTTP Server');
	const server = http.createServer(app);

	// Initialize socket.io
	await socketio.init(server, db.admin as Mongoose);

	return server;
}
