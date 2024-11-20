import path from 'path';

import { Authenticator } from '@fastify/passport';
import { globSync } from 'glob';
import passport from 'passport';

import { User } from '../app/core/user/user.model';

export const initSocketIO = async () => {
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
			'-salt -password'
		)
			.then((user) => done(null, user))
			.catch(done);
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

export const initFastify = async (fastifyPassport: Authenticator) => {
	// Serialize sessions
	fastifyPassport.registerUserSerializer((user) => {
		return user['id'];
	});

	// Deserialize sessions
	fastifyPassport.registerUserDeserializer((id) => {
		return User.findById(id, '-salt -password');
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
			fastifyPassport.use(strategy);
		})
	);
};
