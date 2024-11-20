import { fastify, FastifyPluginCallback } from 'fastify';

import { IUser, User } from '../app/core/user/user.model';

type FastifyTestConfig = {
	logger?: boolean | { level: string };
	user?: Partial<IUser>;
};
export const fastifyTest = (
	plugin: FastifyPluginCallback,
	{ logger, user }: FastifyTestConfig
) => {
	const instance = fastify({ logger: logger ?? false });
	instance.decorateRequest('user', {
		getter() {
			return new User(user);
		}
	});
	instance.decorateRequest('isAuthenticated', function () {
		return !!this.user;
	});
	instance.register(plugin);
	return instance;
};
