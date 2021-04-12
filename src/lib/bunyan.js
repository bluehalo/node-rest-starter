'use strict';

const bunyan = require('bunyan'),
	config = require('../config');

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
	c = c || {};

	// Initialize the app log config (defaults to console warn)
	if (null == c.application) {
		c.application = [];
		c.application.push({
			stream: process.stdout,
			level: 'warn'
		});
	}

	// Initialize the audit log config (should always be info)
	if (null == c.audit) {
		c.audit = [];
		c.audit.push({
			stream: process.stdout,
			level: 'info'
		});
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
	if (null != req && null != req.session && null != req.session.passport) {
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

const auditLogger = bunyan.createLogger({
	name: 'audit',
	streams: loggerConfig.audit,
	serializers: {
		req: reqSerializer,
		err: bunyan.stdSerializers.err
	}
});

const metricsLogger = bunyan.createLogger({
	name: 'metrics',
	streams: loggerConfig.metrics
});

/*
 * Public API
 */
module.exports.logger = appLogger;
module.exports.auditLogger = {
	audit: function (
		message,
		eventType,
		eventAction,
		eventActor,
		eventObject,
		userAgentObject
	) {
		const a = {
			audit: {
				type: eventType,
				action: eventAction,
				actor: eventActor,
				object: eventObject,
				userAgent: userAgentObject
			}
		};

		auditLogger.info(a, message);
	}
};

module.exports.metricsLogger = {
	log: function (payload) {
		metricsLogger.info({ metricsEvent: payload });
	}
};
