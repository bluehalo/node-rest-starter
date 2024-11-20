import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance } from 'fastify';

import userAuthService from './user-authentication.service';
import userAuthorizationService from './user-authorization.service';
import userPasswordService from './user-password.service';
import { auditService, config } from '../../../../dependencies';
import { BadRequestError } from '../../../common/errors';
import teamService from '../../teams/teams.service';
import userEmailService from '../user-email.service';
import { User } from '../user.model';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'POST',
		url: '/auth/signin',
		schema: {
			tags: ['Auth'],
			description: 'authenticates the user',
			body: {
				type: 'object',
				properties: {
					username: { type: 'string' },
					password: { type: 'string' }
				},
				required: ['username', 'password']
			}
		},
		handler: async function (req, reply) {
			const user = await userAuthService.authenticateAndLogin(req, reply);
			if (user) {
				userAuthorizationService.updateRoles(user);
				await teamService.updateTeams(user);
				return reply.send(user);
			}
			return reply;
		}
	});

	fastify.route({
		method: 'GET',
		url: '/auth/signout',
		schema: {
			tags: ['Auth'],
			description: 'Signs out the user.'
		},
		handler: async function (req, reply) {
			await req.logout();
			return reply.redirect('/');
		}
	});

	/**
	 * Routes that only apply to the 'local' passport strategy
	 */
	if (config.get('auth.strategy') === 'local') {
		fastify.route({
			method: 'POST',
			url: '/auth/signup',
			schema: {
				tags: ['Auth'],
				description: 'Signs out the user.',
				body: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						username: { type: 'string' },
						organization: { type: 'string' },
						email: { type: 'string' },
						password: { type: 'string' }
					},
					required: ['name', 'username', 'password']
				}
			},
			handler: async function (req, reply) {
				const newUser = new User(req.body);
				newUser.provider = 'local';

				await newUser.save();

				auditService
					.audit('user signup', 'user', 'user signup', req, newUser.auditCopy())
					.then();

				userEmailService.signupEmail(newUser, req).then();

				const user = await userAuthService.authenticateAndLogin(req, reply);
				if (user) {
					userAuthorizationService.updateRoles(user);
					await teamService.updateTeams(user);
					return reply.send(user);
				}
				return reply;
			}
		});

		fastify.route({
			method: 'POST',
			url: '/auth/forgot',
			schema: {
				tags: ['Auth'],
				description: 'Initiates password reset',
				body: {
					type: 'object',
					properties: {
						username: { type: 'string' }
					},
					required: ['username']
				}
			},
			handler: async function (req, reply) {
				const user = await userPasswordService.initiatePasswordReset(
					req.body.username,
					req
				);
				return reply.send(
					`An email has been sent to ${user.email} with further instructions.`
				);
			}
		});

		fastify.route({
			method: 'GET',
			url: '/auth/reset/:token',
			schema: {
				tags: ['Auth'],
				description: 'Validates password reset token',
				params: {
					type: 'object',
					properties: {
						token: { type: 'string' }
					},
					required: ['token']
				}
			},
			handler: async function (req, reply) {
				const user = await userPasswordService.findUserForActiveToken(
					req.params.token
				);
				if (!user) {
					throw new BadRequestError('invalid-token');
				}
				return reply.send({ message: 'valid-token' });
			}
		});

		fastify.route({
			method: 'POST',
			url: '/auth/reset/:token',
			schema: {
				tags: ['Auth'],
				description: 'Resets password',
				params: {
					type: 'object',
					properties: {
						token: { type: 'string' }
					},
					required: ['token']
				},
				body: {
					type: 'object',
					properties: {
						password: { type: 'string' }
					},
					required: ['password']
				}
			},
			handler: async function (req, reply) {
				const user = await userPasswordService.resetPasswordForToken(
					req.params.token,
					req.body.password
				);
				await userPasswordService.sendPasswordResetConfirmEmail(user, req);

				return reply.send(
					`An email has been sent to ${user.email} letting them know their password was reset.`
				);
			}
		});
	}
}
