import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance, FastifyRequest } from 'fastify';
import _ from 'lodash';

import { requireAccess, requireLogin } from './auth/auth.middleware';
import userAuthorizationService from './auth/user-authorization.service';
import userService from './user.service';
import { auditService } from '../../../dependencies';
import { BadRequestError } from '../../common/errors';
import { PagingQueryStringSchema, SearchBodySchema } from '../core.schemas';
import teamService from '../teams/teams.service';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'GET',
		url: '/user/me',
		schema: {
			tags: ['User'],
			description: 'Returns details about the authenticated user.'
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			const user = req.user.fullCopy();

			userAuthorizationService.updateRoles(user);

			await teamService.updateTeams(user);

			return reply.send(user);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/user/me',
		schema: {
			tags: ['User'],
			description: 'Updates details about the authenticated user.',
			body: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					organization: { type: 'string' },
					email: { type: 'string' },
					username: { type: 'string' },
					password: { type: 'string' },
					currentPassword: { type: 'string' }
				},
				required: ['name', 'organization', 'email', 'username']
			}
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			// Get the full user (including the password)
			const user = await userService.read(req.user._id);
			const originalUser = user.auditCopy();

			// Copy over the new user properties
			user.name = req.body.name;
			user.organization = req.body.organization;
			user.email = req.body.email;
			user.username = req.body.username;

			// If they are changing the password, verify the current password
			if (_.isString(req.body.password) && !_.isEmpty(req.body.password)) {
				if (!user.authenticate(req.body.currentPassword)) {
					// Audit failed authentication
					auditService
						.audit(
							'user update authentication failed',
							'user',
							'update authentication failed',
							req,
							{}
						)
						.then();

					throw new BadRequestError('Current password invalid');
				}

				// We passed the auth check and we're updating the password
				user.password = req.body.password;
			}

			// Save the user
			await user.save();

			// Remove the password/salt
			delete user.password;
			delete user.salt;

			// Audit user update
			auditService
				.audit('user updated', 'user', 'update', req, {
					before: originalUser,
					after: user.auditCopy()
				})
				.then();

			return reply.send(user.fullCopy());
		}
	});

	fastify.route({
		method: 'GET',
		url: '/user/:id',
		schema: {
			tags: ['User'],
			description: ''
		},
		preValidation: requireAccess,
		preHandler: loadUserById,
		handler: function (req, reply) {
			return reply.send(req.userParam.filteredCopy());
		}
	});

	fastify.route({
		method: 'POST',
		url: '/user-preference',
		schema: {
			tags: ['User'],
			description: '',
			body: {
				type: 'object'
			}
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			await userService.updatePreferences(req.user, req.body);
			return reply.send({});
		}
	});

	fastify.route({
		method: 'POST',
		url: '/users',
		schema: {
			tags: ['User'],
			description: 'Returns users matching search criteria',
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			// Handle the query/search
			const query = req.body.q;
			const search = req.body.s;

			const results = await userService.searchUsers(req.query, query, search);
			const mappedResults = {
				pageSize: results.pageSize,
				pageNumber: results.pageNumber,
				totalSize: results.totalSize,
				totalPages: results.totalPages,
				elements: results.elements.map((user) => user.filteredCopy())
			};
			return reply.send(mappedResults);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/user/match',
		schema: {
			tags: ['User'],
			description: '',
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: requireAccess,
		preHandler: loadUserById,
		handler: async function (req, reply) {
			// Handle the query/search/page
			const query = req.body.q;
			const search = req.body.s;

			const results = await userService.searchUsers(req.query, query, search, [
				'name',
				'username',
				'email'
			]);
			const mappedResults = {
				pageSize: results.pageSize,
				pageNumber: results.pageNumber,
				totalSize: results.totalSize,
				totalPages: results.totalPages,
				elements: results.elements.map((user) => user.filteredCopy())
			};
			return reply.send(mappedResults);
		}
	});
}

// User middleware - stores user corresponding to id in 'userParam'
export async function loadUserById(req: FastifyRequest) {
	const id = req.params['id'];
	req.userParam = await userService.read(id);

	if (!req.userParam) {
		throw new Error(`Failed to load User ${id}`);
	}
}
