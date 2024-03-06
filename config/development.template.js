'use strict';

/**
 * Copy this file to 'development.js' and selectively pull in properties
 * to override the properties in 'default.js'.
 */
module.exports = {
	mode: 'development',

	// Basic title and instance name
	app: {
		title: 'Node REST Starter (Development Settings)',
		clientUrl: 'http://localhost:4200/#',
		helpUrl: 'http://localhost:4200/#/help'
	},

	/**
	 * Core System Settings
	 */
	// MongoDB
	db: {
		admin: 'mongodb://127.0.0.1/node-rest-starter-dev'
	},
	mongooseFailOnIndexOptionsConflict: false,

	/**
	 * Environment Settings
	 */

	// Configuration for outgoing mail server
	mailer: {
		provider: './src/app/core/email/providers/log-email.provider'
	},

	/**
	 * Development/debugging settings
	 */
	mongooseLogging: false,
	expressLogging: false,
	exposeServerErrors: true,

	/**
	 * Logging Settings
	 */
	logger: {
		application: {
			console: {
				level: 'debug'
			},
			file: {
				enabled: true,
				level: 'debug',
				directory: './logs'
			}
		},
		audit: {
			console: {
				enabled: true
			},
			file: {
				enabled: false,
				directory: './logs'
			}
		},
		metrics: {
			console: {
				enabled: true
			},
			file: {
				enabled: false,
				directory: './logs'
			}
		}
	},

	/**
	 * UI Settings
	 */
	// Header/footer
	banner: {
		// The string to display
		html: 'DEVELOPMENT SETTINGS',

		// additional CSS class to apply to the banner
		style: 'default'
	}
};
