import bunyan from 'bunyan';

import config from '../config';

/**
 * Initialize the log configuration object
 * This method will create the default console logger
 * if it is missing from the config
 *
 * @param c The logger config block
 * @returns {*|{}}
 */
function initializeConfig(c) {
	// Initialize the log config to empty if it doesn't exist
	c = c ?? {};

	// Initialize the app log config (defaults to console warn)
	if (null == c.application) {
		c.application = [
			{
				stream: process.stdout,
				level: 'warn'
			}
		];
	}

	// Initialize the audit log config (should always be info)
	if (null == c.audit) {
		c.audit = [
			{
				stream: process.stdout,
				level: 'info'
			}
		];
	}

	return c;
}

/**
 * Request serializer function
 * Add the request user to the serialization object
 *
 * @param req Express request object
 * @returns {{method, url, headers, remoteAddress, remotePort}}
 */
function reqSerializer(req) {
	const output = bunyan.stdSerializers.req(req);
	if (req?.session?.passport) {
		output.user = req.session.passport.user;
	}

	return output;
}

// Initialize the Config Object
const loggerConfig = initializeConfig(config.logger);

const appLogger = bunyan.createLogger({
	name: 'application',
	streams: loggerConfig.application,
	serializers: {
		req: reqSerializer,
		err: bunyan.stdSerializers.err
	}
});

const _auditLogger = bunyan.createLogger({
	name: 'audit',
	streams: loggerConfig.audit,
	serializers: {
		req: reqSerializer,
		err: bunyan.stdSerializers.err
	}
});

const _metricsLogger = bunyan.createLogger({
	name: 'metrics',
	streams: loggerConfig.metrics
});

/*
 * Public API
 */
export const logger = appLogger;
export const auditLogger = {
	audit: (
		message,
		eventType,
		eventAction,
		eventActor,
		eventObject,
		userAgentObject
	) => {
		const a = {
			audit: {
				type: eventType,
				action: eventAction,
				actor: eventActor,
				object: eventObject,
				userAgent: userAgentObject
			}
		};

		_auditLogger.info(a, message);
	}
};
export const metricsLogger = {
	log: (payload: unknown) => {
		_metricsLogger.info({ metricsEvent: payload });
	}
};
