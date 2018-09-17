'use strict';

const
	deps = require('../../dependencies'),
	config = deps.config;

module.exports.verify = function(role) {

	return function(req, res, next) {
		// Grab the Authentication header
		let authentication = req.headers.authentication;
		if (null == authentication) {
			return res.status(400).json({
				message: 'No Authentication header present.'
			});
		}

		// Break the Authentication information into token and secret
		let tokens = authentication.split(':');
		if(tokens.length < 2) {
			return res.status(400).json({
				message: 'Invalid Authentication header.'
			});
		}

		let token = tokens[0];
		let secret = tokens[1];

		// Search for the token to validate against the secret
		let credentials;
		let accessList = config.auth.apiAccessList;

		// Make sure the accessList and role exist in the config
		if(null != accessList && null != accessList[role]) {

			// Search the list of token/secrets for the role
			credentials = accessList[role].find(function(element) {
				return (null != element.token && element.token === token);
			});

		}

		// If it isn't found or it's wrong, reject the call
		if(null == credentials || secret !== credentials.secret) {
			return res.status(401).json({
				message: 'Bad authentication data.'
			});
		}

		// It's good so continue
		next();
	};
};
