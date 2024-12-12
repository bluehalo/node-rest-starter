import { Type, TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { FilterQuery, PopulateOptions } from 'mongoose';

import { requireAdminAccess } from './auth/auth.hooks';
import userAuthorizationService from './auth/user-authorization.service';
import userEmailService from './user-email.service';
import { loadUserById } from './user.controller';
import { Roles, User, UserDocument } from './user.model';
import userService from './user.service';
import { CreateUserType, AdminUpdateUserType } from './user.types';
import { auditService, config, utilService } from '../../../dependencies';
import {
	IdParamsType,
	PagingQueryStringType,
	SearchBodyType
} from '../core.types';
import { Callbacks } from '../export/callbacks';
import * as exportConfigController from '../export/export-config.controller';
import { loadExportConfigById } from '../export/export-config.controller';
import { IExportConfig } from '../export/export-config.model';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/admin/users',
		schema: {
			description: 'Returns users that match the search criteria',
			tags: ['User'],
			body: SearchBodyType,
			querystring: PagingQueryStringType
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			// Handle the query/search/page
			const query = userAuthorizationService.updateUserFilter(req.body.q);
			const search = req.body.s;

			const results = await userService.searchUsers(
				req.query,
				query,
				search,
				[],
				{
					path: 'teams.team',
					options: { select: { name: 1 } }
				}
			);
			const mappedResults = {
				pageNumber: results.pageNumber,
				pageSize: results.pageSize,
				totalPages: results.totalPages,
				totalSize: results.totalSize,
				elements: results.elements.map((user) => {
					const userCopy = user.fullCopy();
					userAuthorizationService.updateRoles(userCopy);
					return userCopy;
				})
			};
			return reply.send(mappedResults);
		}
	});

	fastify.route({
		method: 'GET',
		url: '/admin/user/:id',
		schema: {
			description: '',
			tags: ['User'],
			params: IdParamsType
		},
		preValidation: requireAdminAccess,
		preHandler: loadUserById,
		handler: function (req, reply) {
			return reply.send(req.userParam.fullCopy());
		}
	});

	fastify.route({
		method: 'POST',
		url: '/admin/user/:id',
		schema: {
			description: '',
			tags: ['User'],
			body: AdminUpdateUserType,
			params: IdParamsType
		},
		preValidation: requireAdminAccess,
		preHandler: loadUserById,
		handler: async function (req, reply) {
			// The persistence user
			const user = req.userParam;

			// A copy of the original user for auditing
			const originalUser = user.auditCopy();
			const originalUserRole = user.roles?.user ?? null;

			// Copy over the new user properties
			user.name = req.body.name;
			user.organization = req.body.organization;
			user.email = req.body.email;
			user.phone = req.body.phone;
			user.username = req.body.username;
			user.roles = req.body.roles;
			user.bypassAccessCheck = req.body.bypassAccessCheck;

			if (_.isString(req.body.password) && !_.isEmpty(req.body.password)) {
				user.password = req.body.password;
			}

			// Save the user
			await userService.update(user);

			const newUserRole = user.roles?.user ?? null;

			// Audit user update
			auditService
				.audit('admin user updated', 'user', 'admin update', req, {
					before: originalUser,
					after: user.auditCopy()
				})
				.then();

			if (originalUserRole !== newUserRole && newUserRole) {
				await userEmailService.emailApprovedUser(user);
			}

			return reply.send(user.fullCopy());
		}
	});

	if (config.get('allowDeleteUser')) {
		fastify.route({
			method: 'DELETE',
			url: '/admin/user/:id',
			schema: {
				description: '',
				tags: ['User'],
				params: IdParamsType
			},
			preValidation: requireAdminAccess,
			preHandler: loadUserById,
			handler: async function (req, reply) {
				// Init Variables
				const user = req.userParam;

				await auditService.audit(
					'admin user deleted',
					'user',
					'admin delete',
					req,
					user.auditCopy()
				);
				await userService.remove(user);
				return reply.send(user.fullCopy());
			}
		});
	}

	fastify.route({
		method: 'POST',
		url: '/admin/users/getAll',
		schema: {
			description: '',
			tags: ['User'],
			body: Type.Object({
				field: Type.String(),
				query: Type.Optional(Type.Object({}, { additionalProperties: true }))
			})
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const field = req.body.field;
			const query = req.body.query ?? {};

			const results = await User.distinct(
				field,
				utilService.toMongoose(query)
			).exec();

			return reply.send(results);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/admin/user',
		schema: {
			description: 'Create a new user',
			tags: ['User'],
			body: CreateUserType
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const user = new User(User.createCopy(req.body));
			user.bypassAccessCheck = req.body.bypassAccessCheck;
			user.roles = req.body.roles;

			if (config.get('auth.strategy') === 'local') {
				user.provider = 'local';

				// Need to set null passwords to empty string for mongoose validation to work
				if (null == user.password) {
					user.password = '';
				}
			} else if (config.get('auth.strategy') === 'proxy-pki') {
				user.provider = 'pki';

				if (req.body.username) {
					user.username = req.body.username;
					user.providerData = {
						dn: req.body.username,
						dnLower: req.body.username.toLowerCase()
					};
				}
			}

			// Initialize the user
			await user.save();

			auditService
				.audit(
					'admin user create',
					'user',
					'admin user create',
					req,
					user.auditCopy()
				)
				.then();

			return reply.send(user.fullCopy());
		}
	});

	fastify.route({
		method: 'GET',
		url: '/admin/users/csv/:id',
		schema: {
			description: 'Export users as CSV file',
			tags: ['User'],
			params: IdParamsType
		},
		preValidation: requireAdminAccess,
		preHandler: loadExportConfigById,
		handler: function (req, reply) {
			const exportConfig = req.exportConfig as IExportConfig;
			const exportQuery = req.exportQuery as FilterQuery<UserDocument>;

			const fileName = `${config.get('app.instanceName')}-${
				exportConfig.type
			}.csv`;

			// Replace `roles` column with individual columns for each role
			const columns = exportConfig.config.cols.filter(
				(col) => ['roles'].indexOf(col.key) === -1
			);
			if (columns.length !== exportConfig.config.cols.length) {
				for (const role of Roles) {
					columns.push({
						key: `roles.${role}`,
						title: `${role} Role`,
						callback: Callbacks.trueFalse
					});
				}
			}

			const populate: PopulateOptions[] = [];

			// Based on which columns are requested, handle property-specific behavior (ex. callbacks for the
			// CSV service to make booleans and dates more human-readable)
			columns.forEach((col) => {
				col.title = col.title ?? _.capitalize(col.key);

				switch (col.key) {
					case 'bypassAccessCheck':
						col.callback = Callbacks.trueFalse;
						break;
					case 'lastLogin':
					case 'created':
					case 'updated':
					case 'acceptedEua':
						col.callback = Callbacks.isoDateString;
						break;
					case 'teams':
						populate.push({ path: 'teams.team', select: 'name' });
						col.callback = Callbacks.mapAndJoinArray(
							(team: { team: { name: string } }) => team.team.name
						);
						break;
				}
			});

			const cursor = userService.cursorSearch(
				exportConfig.config,
				exportConfig.config.s,
				exportQuery,
				[],
				populate
			);

			exportConfigController.exportCSV(req, reply, fileName, columns, cursor);

			return reply;
		}
	});
}
