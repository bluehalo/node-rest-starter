'use strict';

const contactEmail = process.env.CONTACT_EMAIL || 'noreply@bluehalo.com';

module.exports = {
	mode: 'production',

	port: 3000,

	// Basic title and instance name
	app: {
		title: 'Node REST Starter',
		instanceName: 'node-rest-starter',
		description: 'Node REST app',
		clientUrl: 'http://localhost/#',
		helpUrl: 'http://localhost/#/help',
		contactEmail: 'noreply@bluehalo.com'
	},

	/**
	 * Core System Settings
	 */

	apiDocs: {
		enabled: true,
		path: '/api-docs',
		jsonPath: '/api/spec.json',
		uiOptions: {}
	},

	actuator: {
		enabled: true,
		options: {
			basePath: '/actuator'
		}
	},

	// SocketIO Settings
	socketio: {
		ignoreOlderThan: 600
	},
	// Use the following for local eventEmitter
	publishProvider: './src/app/common/event/event-publish.provider',
	socketProvider: './src/app/common/sockets/event-socket.provider',

	messages: {
		topic: 'message.posted'
	},

	pages: {
		topic: 'page.updated'
	},

	cors: {
		enabled: false,
		options: {
			credentials: true
		}
	},

	assets: {
		models: ['src/**/*.model!(.spec).{js,ts}'],
		routes: ['src/**/*.routes!(.spec).{js,ts}'],
		sockets: ['src/**/*.socket!(.spec).{js,ts}'],
		config: ['src/**/*.config!(.spec).js'],
		docs: ['src/**/*/*.components.yml'],
		// Test specific source files
		tests: ['src/**/*.spec.{js,ts}'],
		e2e: ['e2e/**/*.spec.{js, ts}']
	},

	/**
	 * When using the 'proxy-pki' authentication strategy,
	 * this will be the header used to retrieve the user's
	 * DN for initial authentication and use through the system.
	 */
	proxyPkiPrimaryUserHeader: 'x-ssl-client-s-dn',

	/**
	 * When using the 'proxy-pki' authentication strategy,
	 * this will be the header used to retrieve the optional
	 * proxied user's DN for combined authentication and
	 * use through the system.
	 */
	proxyPkiProxiedUserHeader: 'x-proxied-user-dn',

	/**
	 * When using the 'proxy-pki' authentication strategy,
	 * this will be the header used to retrieve the optional
	 * masquerade user's DN for admin masquerade access
	 */
	masqueradeUserHeader: 'x-masquerade-user-dn',

	// Auth system
	auth: {
		/**
		 * The API Access List grants token/secret-based access to specific endpoints in the application
		 */
		apiAccessList: {
			// externalApi: [
			// 	{ token: 'blah', secret: 'secret'}
			// ]
		},

		/**
		 * 'local' strategy uses a locally managed username/password and user profile
		 */
		strategy: 'local',

		/**
		 * 'proxy-pki' strategy assumes that the Node app is behind an SSL terminating
		 * proxy server. The proxy is responsible for passing the DN of the incoming
		 * user in the the 'x-ssl-client-dn' header.
		 */
		// strategy: 'proxy-pki',

		// accessChecker: {
		// 	provider: {
		// 		file: 'src/app/core/access-checker/providers/example.provider',
		// 		config: {
		// 			'user cn string': {
		// 				name: 'User Name',
		// 				profileOrganization: 'User Organization',
		// 				email: 'user@email.com',
		// 				username: 'username',
		// 				roles: [ 'ROLE' ]
		// 			}
		// 		}
		// 	},
		// 	cacheExpire: 1000*60*60*24 // expiration of cache entries
		// },

		autoLogin: false,
		autoCreateAccounts: false,
		defaultRoles: {},
		requiredRoles: [],

		roles: ['user', 'editor', 'auditor', 'admin'],
		roleStrategy: 'local', // 'local' || 'external' || 'hybrid'
		masquerade: true, // set to false to disable admin masquerading when using proxy-pki

		externalRoles: {
			provider: {
				file: 'src/app/core/user/auth/default-external-role-map.provider',
				config: {
					externalRoleMap: {
						user: 'USER',
						admin: 'ADMIN',
						auditor: 'AUDITOR',
						editor: 'EDITOR'
					}
				}
			}
		},

		/**
		 * Session settings are required regardless of auth strategy
		 */

		// Session Expiration controls how long sessions can live (in ms)
		sessionCookie: {
			maxAge: 24 * 60 * 60 * 1000
		},

		// Session secret is used to validate sessions
		sessionSecret: 'AJwo4MDj932jk9J5jldm34jZjnDjbnASqPksh4',

		// Session mongo collection
		sessionCollection: 'sessions'
	},

	agenda: {
		enabled: true,
		jobs: [
			// {
			// 	file: './src/app/core/access-checker/cache/cache-refresh.job',
			// 	name: 'cache-refresh',
			// 	interval: '12 hours',
			// 	data: {
			// 		refresh: 12 * 3600000
			// 	}
			// },
			// {
			// 	file: './src/app/core/user/inactive/inactive-user.job',
			// 	name: 'inactive-user',
			// 	interval: '1 days',
			// 	data: {
			// 		alertIntervals: [
			// 			30 * 86400000, // 30 days
			// 			60 * 86400000 // 60 days
			// 		],
			// 		deactivateAfter: 90 * 86400000 // 90 days
			// 	}
			// },
			// {
			// 	file: 'path/to/job/definition',
			// 	name: 'job-name',
			// 	options: {},
			// 	interval: '0 * * * *'
			// }
		]
	},

	// MongoDB
	db: {
		admin: 'mongodb://localhost/node-rest-starter-dev'
	},
	mongooseFailOnIndexOptionsConflict: true,

	/*
	 * The maximum time in milliseconds allowed for processing operation on the cursor by a mongo query
	 */
	maxTimeMS: 30000,

	/*
	 * The maximum time in milliseconds allowed for a count operation on the cursor by a mongo search/pagination query
	 */
	maxCountTimeMS: 5000,

	// configures mongo TTL index.  Overriding these may require dropping existing index
	notificationExpires: 15552000, // 180 days
	auditExpires: 15552000, //180 days
	feedbackExpires: 15552000, // 180 days

	/**
	 * Environment Settings
	 */

	// Configuration for outgoing mail server / service
	mailer: {
		from: 'USERNAME@GMAIL.COM',
		provider: './src/app/core/email/providers/smtp-email.provider',
		options: {
			host: 'gmail',
			port: 587,
			secure: false, // true for 465, false for other ports
			auth: {
				user: 'USERNAME@GMAIL.COM',
				pass: 'PASSWORD'
			}
		}
		/*
		provider: './src/app/core/email/providers/log-email.server.provider',
		options: {}
		*/
		/*
		provider: './src/app/core/email/providers/https-email.server.provider',
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

	coreEmails: {
		default: {
			header: 'HEADER',
			footer: 'FOOTER',
			from: contactEmail,
			replyTo: contactEmail
		},
		userSignupAlert: {
			enabled: true,
			templatePath:
				'src/app/core/user/templates/user-signup-alert-email.server.view.html',
			subject: 'New Account Request - {{ app.clientUrl }}',
			to: contactEmail
		},
		welcomeNoAccess: {
			enabled: true,
			skipIfUserHasRole: 'user',
			templatePath:
				'src/app/core/user/templates/user-welcome-no-access-email.server.view.html',
			subject: 'Welcome to {{ app.title }} - No Access!'
		},
		welcomeWithAccess: {
			enabled: true,
			recentDuration: { days: 90 },
			accessRole: 'user',
			templatePath:
				'src/app/core/user/templates/user-welcome-with-access-email.server.view.html',
			subject: 'Welcome to {{ app.title }}!'
		},
		approvedUserEmail: {
			enabled: true,
			templatePath:
				'src/app/core/user/templates/approved-user-email.server.view.html',
			subject: 'Your {{ app.title }} account has been approved!'
		},
		feedbackEmail: {
			templatePath:
				'src/app/core/feedback/templates/user-feedback-email.view.html',
			subject: '{{ app.title }}: Feedback Submitted',
			bcc: contactEmail
		},
		teamAccessRequestEmail: {
			templatePath:
				'src/app/core/teams/templates/user-request-access-email.view.html',
			subject:
				'{{ app.title }}: A user has requested access to Team {{ team.name }}'
		},
		newTeamRequest: {
			templatePath:
				'src/app/core/teams/templates/user-request-new-team-email.view.html',
			subject: 'New Team Requested',
			bcc: contactEmail
		},
		userInactivity: {
			templatePath:
				'src/app/core/user/templates/inactivity-email.server.view.html',
			subject: '{{ app.title }}: Inactivity Notice'
		},
		userDeactivate: {
			templatePath:
				'src/app/core/user/templates/deactivate-email.server.view.html',
			subject: '{{ app.title }}: Account Deactivation'
		},
		resetPassword: {
			templatePath:
				'src/app/core/user/templates/reset-password-email.server.view.html',
			subject: 'Password Reset'
		},
		resetPasswordConfirm: {
			templatePath:
				'src/app/core/user/templates/reset-password-confirm-email.server.view.html',
			subject: 'Your password has been changed'
		}
	},

	siteEmails: {},

	teams: {
		implicitMembers: {
			/**
			 * 'roles' strategy matches user.externalRoles against team.requiresExternalRoles to determine implicit
			 * membership in team.  User must have all of the specified roles to be granted access to team.
			 */
			strategy: 'roles'

			/**
			 * 'teams' strategy matches user.externalGroups against team.requiresExternalGroups to determine implicit
			 * membership in team.  User mush have one of the specified roles to be granted access to team.
			 */
			// strategy: 'teams'
		},
		nestedTeams: false
	},

	/*
	 * Whether the delete user functionality is enabled or disabled
	 */
	allowDeleteUser: true,

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
				stream: 'process.stdout',
				level: 'warn'
			} //,
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
				stream: 'process.stdout',
				level: 'info'
			} //,
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
				stream: 'process.stdout',
				level: 'info'
			} //,
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
	 * UI Settings
	 */
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
		html: '© 2024 <a href="http://www.bluehalo.com" target="_blank">BLUEHALO</a>'
	},

	feedback: {
		showFlyout: true,
		showInSidebar: true,

		classificationOpts: [
			{ level: 'LEVEL-1', prefix: '(L1)' },
			{ level: 'LEVEL-2', prefix: '(L2)' },
			{ level: 'LEVEL-3', prefix: '(L3)' }
		]
	}
};
