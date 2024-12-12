import path from 'path';

import { Authenticator } from '@fastify/passport';
import { globSync } from 'glob';
import { Types } from 'mongoose';
import passport from 'passport';

import { User, UserDocument } from '../app/core/user/user.model';

export const initSocketIO = async () => {
	// Serialize sessions
	passport.serializeUser((user, done) => {
		done(null, (user as { _id: Types.ObjectId })._id.toString());
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
	fastifyPassport.registerUserSerializer<UserDocument, string>((user) => {
		return Promise.resolve(user._id.toString());
	});

	// Deserialize sessions
	fastifyPassport.registerUserDeserializer<string, UserDocument>((id) => {
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
