'use strict';

const
	deps = require('../../../dependencies'),
	config = deps.config,
	pkg = require('../../../../package.json');


let getSystemConfig = function() {
	let toReturn = {

		auth: config.auth.strategy,
		app: config.app,
		requiredRoles: config.auth.requiredRoles,

		version: pkg.version,
		banner: config.banner,
		copyright: config.copyright,

		contactEmail: config.app.contactEmail,

		maxExport: config.maxExport,
		feedback: config.feedback
	};

	return toReturn;
};

exports.getSystemConfig = getSystemConfig;

// Read
exports.read = function(req, res) {
	/**
	 *  Add unsecured configuration data
	 */
	res.json(getSystemConfig());
};
