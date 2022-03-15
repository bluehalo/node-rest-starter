'use strict';

const deps = require('../../../dependencies'),
	config = deps.config,
	pkg = require('../../../../package.json');

const getSystemConfig = function () {
	const toReturn = {
		auth: config.auth.strategy,
		apiDocs: config.apiDocs,
		app: config.app,
		requiredRoles: config.auth.requiredRoles,

		version: pkg.version,
		banner: config.banner,
		copyright: config.copyright,

		contactEmail: config.app.contactEmail,

		maxExport: config.maxExport,
		feedback: config.feedback,
		teams: config.teams,

		userPreferences: config.userPreferences,

		masqueradeEnabled:
			config.auth.strategy === 'proxy-pki' && config.auth.masquerade === true,
		masqueradeUserHeader: config.masqueradeUserHeader
	};

	return toReturn;
};

exports.getSystemConfig = getSystemConfig;

// Read
exports.read = function (req, res) {
	/**
	 *  Add unsecured configuration data
	 */
	res.json(getSystemConfig());
};
