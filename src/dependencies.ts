import csvStream from './app/common/csv-stream.service';
import delayedStream from './app/common/delayed-stream.service';
import * as errorService from './app/common/errors.service';
import * as utilService from './app/common/util.service';
import auditService from './app/core/audit/audit.service';
import emailService from './app/core/email/email.service';
import config from './config';
import { logger, auditLogger, metricsLogger } from './lib/bunyan';
import { dbs } from './lib/mongoose';
import socketIO from './lib/socket.io';

export {
	// Main config module
	config,
	// Logging and Auditing
	logger,
	auditLogger,
	metricsLogger,
	// Access to the MongoDB db objects
	dbs,
	// Socket IO
	socketIO,
	// Common Services
	csvStream,
	delayedStream,
	errorService,
	utilService,
	// Core Services
	auditService,
	emailService
};
