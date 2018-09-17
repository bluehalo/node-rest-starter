'use strict';

const
	passport = require('passport'),
	path = require('path'),

	config = require('../config'),
	User = require('mongoose').model('User');

module.exports.init = function() {
	// Serialize sessions
	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});

	// Deserialize sessions
	passport.deserializeUser(function(id, done) {
		User.findOne({
			_id: id
		}, '-salt -password', function(err, user) {
			done(err, user);
		});
	});

	// Initialize strategies
	config.utils.getGlobbedPaths('./src/server/lib/strategies/**/*.js').forEach(function(strategy) {
		require(path.posix.resolve(strategy))();
	});
};
