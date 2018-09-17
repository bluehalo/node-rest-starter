'use strict';

module.exports = {

	// Running in test mode
	//mode: 'test',

	// Use a test db so we don't modify the real DB
	db: {
		admin: 'mongodb://localhost/node-rest-starter-test'
	},

	// Run tests on something other than default port
	port: 9001,

	/**
	 * Logging Settings
	 */

	// Disable loggers for tests
	logger: {
		application: [
			{
				stream: process.stdout,
				level: 'error'
			}
		],
		audit: []
	}

};
