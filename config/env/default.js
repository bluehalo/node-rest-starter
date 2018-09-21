'use strict';

module.exports = {

	/**
	 * Core System Settings
	 */

	// Auth system
	auth: {
		/*
		 * The API Access List grants token/secret-based access to specific endpoints in the application
		 */
		apiAccessList: {
			// externalApi: [
			// 	{ token: 'blah', secret: 'secret'}
			// ]
		},

		/*
		 * 'local' strategy uses a locally managed username/password and user profile
		 */
		// strategy: 'local',

		/*
		 * 'proxy-pki' strategy assumes that the Node app is behind an SSL terminating
		 * proxy server. The proxy is responsible for passing the DN of the incoming
		 * user in the the 'x-ssl-client-dn' header.
		 */
		strategy: 'proxy-pki',

		accessChecker: {
			provider: {
				file: 'src/app/core/access-checker/providers/example-provider.server.service.js',
				config: {
					'cn=asymmetrikclient,ou=client,o=asymmetrik ltd.,st=maryland,c=us': {
						name: 'Matt PKI',
						profileOrganization: 'Asymmetrik',
						email: 'mgaulin@gmail.com',
						username: 'mgaulin_pki',
						roles: [ 'ROLE' ]
					}
				}
			},
			cacheExpire: 1000*60*60*24 // expiration of cache entries
		},

		autoLogin: true,
		autoCreateAccounts: true,
		requiredRoles: ['ROLE'],
		defaultRoles: { user: true },


		/*
		 * Session settings are required regardless of auth strategy
		 */

		// Session Expiration controls how long sessions can live (in ms)
		sessionCookie: {
			maxAge: 24*60*60*1000
		},

		// Session secret is used to validate sessions
		sessionSecret: 'AJwo4MDj932jk9J5jldm34jZjnDjbnASqPksh4',

		// Session mongo collection
		sessionCollection: 'sessions'

	},

	// Scheduled task runner
	scheduler: {
		services: [
			// {
			// 	file: 'app/access-checker/server/services/cache-refresh.server.service.js',
			// 	interval: 5000,
			// 	config: {
			// 		refresh: 8*3600000 // 8 Hours
			// 	}
			// },
			// {
			// 	file: './src/server/app/util/schedulers/inactive-user-notification.server.service.js',
			// 	interval: 86400000, //every day
			// 	config: {
			// 		deactivateAfter: 90 * 86400000, // deactivate account after 90 days of inactivity
			// 		alertInterval: [
			// 			30 * 86400000,  // 30 days
			// 			60 * 86400000 // 60 days
			// 		]
			// 	}
			// }
		],
		interval: 10000
	},


	// MongoDB
	db: {
		admin: 'mongodb://localhost/node-rest-starter-dev'
	},

	/**
	 * Environment Settings
	 */

	// Basic title and instance name
	app: {
		title: 'Node REST Starter',
		instanceName: 'node-rest-starter'
	},

	// Header/footer
	banner: {
		// The string to display
		html: 'DEFAULT SETTINGS',

		// additional CSS class to apply to the banner
		style: 'default'
	},

	// Copyright footer (shown above the system footer)
	copyright: {
		// HTML-enabled contents of the banner
		html: 'Copyright © 2018 <a href="http://www.asymmetrik.com" target="_blank">Asymmetrik, Ltd</a>. All Rights Reserved.'
	},

	email: {
		header: 'HEADER',
		footer: 'FOOTER',
		subjectPrefix: '(PREFIX)'
	},

	contactEmail: process.env.CONTACT_EMAIL || process.env.MAILER_ADMIN || 'noreply@asymmetrik.com',

	newUser: {
		welcomeNotification: true,
		adminNotification: true,
		email: process.env.CONTACT_EMAIL || 'noreply@asymmetrik.com'
	},

	// Use the following for local eventEmitter
	publishProvider: './src/app/common/event/event-publish.provider.js',
	socketProvider: './src/app/common/sockets/event-socket.provider.js',

	// Use the following for Kafka.  Note, must also uncomment Kafka configuration.
	// publishProvider: './src/app/common/event/kafka-publish.provider.js',
	// socketProvider: './src/app/common/sockets/kafka-socket.provider.js',

	messages: {
		topic: 'message.posted'
	},

	pages: {
		topic: 'page.updated'
	},

	notificationExpires: 15552000, // 180 days

	// Configuration for outgoing mail server / service
	mailer: {
		from: process.env.MAILER_FROM || 'USERNAME@GMAIL.COM',
		provider: './src/server/app/util/providers/email/smtp-email.server.provider.js',
		options: {
			service: process.env.MAILER_SERVICE_PROVIDER || 'gmail',
			auth: {
				user: process.env.MAILER_EMAIL_ID || 'USERNAME@GMAIL.COM',
				pass: process.env.MAILER_PASSWORD || 'PASSWORD'
			}
		}
		/*
		provider: './src/server/app/util/providers/email/log-email.server.provider.js',
		options: {}
		*/
		/*
		provider: './src/server/app/util/providers/email/https-email.server.provider.js',
		options: {
			host: '',
			port: ,
			path: '',
			ca: '/path/to/ca.crt',
			cert: '/path/to/cert.crt',
			key: '/path/to/cert.key'
		}
		*/
	},


	/**
	 * Development/debugging settings
	 */

	// Expose server errors to the client (500 errors)
	exposeServerErrors: true,

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
				level: 'info'
			}//,
			// Rotating file logger
			//{
			//	type: 'rotating-file',
			//	level: 'info',
			//	path: '/usr/local/var/log/mean2/application.log',
			//	period: '1d',
			//	count: 1
			//},
			// Logstash logger
			//{
			//	type: 'raw',
			//	level: 'info',
			//	stream: logstash.createStream({
			//		host: 'localhost',
			//		port: 4561
			//	})
			//}
		],
		audit: [
			// Console logger (audit logger must be 'info' level)
			{
				stream: process.stdout,
				level: 'info'
			}//,
			//{
			//	type: 'rotating-file',
			//	level: 'info',
			//	path: '/usr/local/var/log/mean2/audit.log',
			//	period: '1d',
			//	count: 1
			//}
		],
		metrics: [
			// Console logger (audit logger must be 'info' level)
			{
				stream: process.stdout,
				level: 'info'
			}//,
			//{
			//	type: 'rotating-file',
			//	level: 'info',
			//	path: '/usr/local/var/log/mean2/metrics.log',
			//	period: '1d',
			//	count: 1
			//}
		]
	},



	/**
	 * Not So Environment-Specific Settings
	 */

	apiDocs: {
		enabled: true,
		path: '/api-docs'
	},

	// The port to use for the application (defaults to the environment variable if present)
	port: process.env.PORT || 3001,

	// SocketIO Settings
	socketio: {
		ignoreOlderThan: 600
	},

	// CSV Export Settings
	csv: {
		delayMs: 0
	},

	/*
	 * The maximum number of records allowed to be scanned by a mongo query
	 */
	maxScan: 30000,

	/*
	 * The maximum number of records allowed to be exported to csv
	 */
	maxExport: 1000,

	/*
	 * Configurations for External Services
	 */
	external: { }


};
