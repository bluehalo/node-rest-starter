'use strict';

let passport = require('passport'),
	mongoose = require('mongoose'),
	LocalStrategy = require('passport-local').Strategy,

	User = mongoose.model('User');


module.exports = function() {
	// Use local strategy
	passport.use(new LocalStrategy({
			usernameField: 'username',
			passwordField: 'password'
		},
		function(username, password, done) {

			if(null == username) {
				return done(null, false, {status: 400, type: 'missing-credentials', message: 'No username provided' });
			}

			User.findOne({ username: username }).exec().then(function(user) {

				// The user wasn't found or the password was wrong
				if (!user || !user.authenticate(password)) {
					return done(null, false, {status: 401, type: 'invalid-credentials', message: 'Incorrect username or password' });
				}

				// Return the user
				return done(null, user);

			}, function(err) {
				return done(err);
			}).done();

		}

	));
};
