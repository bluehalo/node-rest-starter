// Need to ensure that config is loaded before other services below.
/* eslint-disable-next-line */
import config from 'config';

import csvStream from './app/common/csv-stream.service';
import delayedStream from './app/common/delayed-stream.service';
import * as utilService from './app/common/util.service';
import auditService from './app/core/audit/audit.service';
import emailService from './app/core/email/email.service';
import { dbs } from './lib/mongoose';
import socketIO from './lib/socket.io';

export {
	// Main config module
	config,
	// Access to the MongoDB db objects
	dbs,
	// Socket IO
	socketIO,
	// Common Services
	csvStream,
	delayedStream,
	utilService,
	// Core Services
	auditService,
	emailService
};
