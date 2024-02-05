import path from 'path';

import { globSync } from 'glob';
import passport from 'passport';

import { User } from '../app/core/user/user.model';

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
		globSync([
			'./src/lib/strategies/**/*.js',
			'./src/lib/strategies/**/*.ts'
		]).map(async (strategyPath) => {
			const { default: strategy } = await import(
				path.posix.resolve(strategyPath)
			);
			passport.use(strategy);
		})
	);
};
