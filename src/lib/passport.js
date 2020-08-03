'use strict';

const
	passport = require('passport'),
	path = require('path'),

	config = require('../config'),
	User = require('mongoose').model('User');

module.exports.init = function() {
	// Serialize sessions
	passport.serializeUser((user, done) => {
		done(null, user.id);
	});

	// Deserialize sessions
	passport.deserializeUser((id, done) => {
		User.findOne({
			_id: id
		}, '-salt -password', (err, user) => {
			done(err, user);
		}).exec();
	});

	// Initialize strategies
	config.utils.getGlobbedPaths('./src/lib/strategies/**/*.js').forEach((strategy) => {
		require(path.posix.resolve(strategy))();
	});
};
