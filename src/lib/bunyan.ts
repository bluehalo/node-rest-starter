import bunyan from 'bunyan';
import config from 'config';

/**
 * Initialize the log configuration object
 * This method will create the default console logger
 * if it is missing from the config
 *
 * @param logConfig The logger config block
 * @returns {*|{}}
 */
function initializeConfig(logConfig) {
	// Initialize the log config to empty if it doesn't exist
	const c: Record<
		string,
		Array<Record<string, unknown>>
	> = config.util.extendDeep(
		{
			// default application log config (defaults to console warn)
			application: [
				{
					stream: process.stdout,
					level: 'warn'
				}
			],
			// default audit log config (should always be info)
			audit: [
				{
					stream: process.stdout,
					level: 'info'
				}
			]
		},
		config.util.toObject(logConfig)
	);

	// Replace string references to stdout/stderr with the real thing
	Object.values(c).forEach((streamConfigs) => {
		streamConfigs.forEach((streamConfig) => {
			if (streamConfig.stream === 'process.stdout') {
				streamConfig.stream = process.stdout;
			}
			if (streamConfig.stream === 'process.stderr') {
				streamConfig.stream = process.stderr;
			}
		});
	});

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
const loggerConfig = initializeConfig(config.get('logger'));

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
		_metricsLogger.info(payload);
	}
};
