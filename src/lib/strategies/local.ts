import { Strategy as LocalStrategy } from 'passport-local';

import { User } from '../../app/core/user/user.model';

export = new LocalStrategy(
	{
		usernameField: 'username',
		passwordField: 'password'
	},
	(username, password, done) => {
		if (!username) {
			return done(null, false, { message: 'No username provided' });
		}

		User.findOne({ username: username })
			.exec()
			.then((user) => {
				// The user wasn't found or the password was wrong
				if (!user || !user.authenticate(password)) {
					return done(null, false, {
						message: 'Incorrect username or password'
					});
				}

				// Return the user
				return done(null, user);
			})
			.catch((error) => done(error));
	}
);
