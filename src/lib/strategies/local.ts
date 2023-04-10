import { Strategy as LocalStrategy } from 'passport-local';

import { UserModel } from '../../app/core/user/user.model';
import { dbs } from '../../dependencies';

const User: UserModel = dbs.admin.model('User');

const verify = (username: string, password: string, done) => {
	if (!username) {
		return done(null, false, {
			status: 400,
			type: 'missing-credentials',
			message: 'No username provided'
		});
	}

	User.findOne({ username: username })
		.exec()
		.then((user) => {
			// The user wasn't found or the password was wrong
			if (!user || !user.authenticate(password)) {
				return done(null, false, {
					status: 401,
					type: 'invalid-credentials',
					message: 'Incorrect username or password'
				});
			}

			// Return the user
			return done(null, user);
		})
		.catch((err) => done(err));
};

export = new LocalStrategy(
	{
		usernameField: 'username',
		passwordField: 'password'
	},
	verify
);
