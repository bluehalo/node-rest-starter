'use strict';

module.exports = {
	// Running in test mode
	mode: 'test',

	// For the mongoose spec
	test: {
		mongoHost: 'mongo'
	},

	// Use a test db so we don't modify the real DB
	db: {
		admin: 'mongodb://mongo/node-rest-starter-test'
	},

	// Run tests on something other than default port
	port: 9001,

	// Configuration for outgoing mail server / service
	mailer: {
		provider: './src/app/core/email/providers/log-email.provider.ts'
	},

	/**
	 * Logging Settings
	 */

	// Disable loggers for tests
	logger: {
		application: {
			silent: true,
			file: {
				enabled: false
			}
		},
		audit: {
			silent: true,
			file: {
				enabled: false
			}
		},
		metrics: {
			silent: true,
			file: {
				enabled: false
			}
		}
	}
};
