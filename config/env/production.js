'use strict';

const logstash = require('bunyan-logstash');

module.exports = {

	/**
	 * System Settings
	 */


	/**
	 * Environment Settings
	 */


	/**
	 * Development/debugging settings
	 */

	// Expose server errors to the client (500 errors)
	exposeServerErrors: false,

	// Mongoose query logging
	mongooseLogging: false,

	// Express route logging
	expressLogging: false,


	/**
	 * Logging Settings
	 */

	// Application logging and logstash
	logger: {
		application: [
			// Console logger
			{
				stream: process.stdout,
				level: 'warn'
			},
			// Rotating file logger
			{
				type: 'rotating-file',
				level: 'warn',
				path: '/var/log/mean2/application.log',
				period: '1d',
				count: 1
			},
			// Logstash logger
			{
				type: 'raw',
				level: 'info',
				stream: logstash.createStream({
					host: 'localhost',
					port: 4561
				})
			}
		],
		audit: [
			// Console logger (audit logger must be 'info' level)
			{
				stream: process.stdout,
				level: 'info'
			},
			// Rotating file logger
			{
				type: 'rotating-file',
				level: 'info',
				path: '/usr/local/var/log/mean2/audit.log',
				period: '1d',
				count: 7
			}
		]
	}


	/**
	 * Not So Environment-Specific Settings
	 */

};
