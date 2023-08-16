import path from 'path';

import passport from 'passport';

import { User } from '../app/core/user/user.model';
import { config } from '../dependencies';

export const init = async () => {
	// Serialize sessions
	passport.serializeUser((user, done) => {
		done(null, user['id']);
	});

	// Deserialize sessions
	passport.deserializeUser((id, done) => {
		User.findOne(
			{
				_id: id
			},
			'-salt -password',
			null,
			done
		);
	});

	// Initialize strategies
	await Promise.all(
		config.utils
			.getGlobbedPaths([
				'./src/lib/strategies/**/*.js',
				'./src/lib/strategies/**/*.ts'
			])
			.map(async (strategyPath) => {
				const { default: strategy } = await import(
					path.posix.resolve(strategyPath)
				);
				passport.use(strategy);
			})
	);
};
