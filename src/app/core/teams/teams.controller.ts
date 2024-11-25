import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { requireTeamAdminRole, requireTeamMemberRole } from './team-auth.hooks';
import { TeamRoles } from './team-role.model';
import teamsService from './teams.service';
import { utilService, auditService } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';
import { audit, auditTrackBefore } from '../audit/audit.hooks';
import { PagingQueryStringSchema, SearchBodySchema } from '../core.schemas';
import {
	requireAccess,
	requireAdminRole,
	requireAny,
	requireEditorAccess
} from '../user/auth/auth.hooks';
import userService from '../user/user.service';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'POST',
		url: '/team',
		schema: {
			description: 'Creates a new Team',
			tags: ['Team'],
			body: {
				type: 'object',
				properties: {
					team: { type: 'object' },
					firstAdmin: { type: 'string' }
				},
				required: ['team']
			}
		},
		preValidation: requireEditorAccess,
		handler: async function (req, reply) {
			const result = await teamsService.create(
				req.body.team,
				req.user,
				req.body.firstAdmin
			);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'team created',
			type: 'team',
			action: 'create'
		})
	});

	fastify.route({
		method: 'POST',
		url: '/teams',
		schema: {
			description: 'Returns teams that match the search criteria',
			tags: ['Team'],
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			// Get search and query parameters
			const search = req.body.s ?? null;
			const query = utilService.toMongoose(req.body.q ?? {});

			const result = await teamsService.search(
				req.query,
				query,
				search,
				req.user
			);
			return reply.send(result);
		}
	});

	fastify.route({
		method: 'GET',
		url: '/team/:id',
		schema: {
			description: 'Gets the details of a Team',
			tags: ['Team'],
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamMemberRole)
		],
		preHandler: loadTeamById,
		handler: function (req, reply) {
			return reply.send(req.team);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/team/:id',
		schema: {
			description: 'Updates the details of a Team',
			tags: ['Team'],
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamAdminRole)
		],
		preHandler: [loadTeamById, auditTrackBefore('team')],
		handler: async function (req, reply) {
			const result = await teamsService.update(req.team, req.body);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'team updated',
			type: 'team',
			action: 'update'
		})
	});

	fastify.route({
		method: 'DELETE',
		url: '/team/:id',
		schema: {
			description: 'Deletes a Team',
			tags: ['Team'],
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamAdminRole)
		],
		preHandler: loadTeamById,
		handler: async function (req, reply) {
			const result = await teamsService.delete(req.team);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'team deleted',
			type: 'team',
			action: 'delete'
		})
	});

	fastify.route({
		method: 'POST',
		url: '/team/:id/request',
		schema: {
			hide: true,
			description:
				'Requests access to a Team. Notifies team admins of the request',
			tags: ['Team']
		},
		preValidation: requireAccess,
		preHandler: loadTeamById,
		handler: async function (req, reply) {
			await teamsService.requestAccessToTeam(req.user, req.team);
			return reply.send();
		}
	});

	fastify.route({
		method: 'POST',
		url: '/team-request',
		schema: {
			hide: true,
			description:
				'Requests a new Team. Notifies the team organization admin of the request.',
			tags: ['Team'],
			body: {
				type: 'object',
				properties: {
					org: { type: 'string' },
					aoi: { type: 'string' },
					description: { type: 'string' }
				}
			}
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			const org = req.body.org ?? null;
			const aoi = req.body.aoi ?? null;
			const description = req.body.description ?? null;

			await teamsService.requestNewTeam(org, aoi, description, req.user);

			await auditService.audit('new team requested', 'team', 'request', req, {
				org,
				aoi,
				description
			});

			return reply.send();
		}
	});

	fastify.route({
		method: 'PUT',
		url: '/team/:id/members',
		schema: {
			description: 'Adds members to a Team',
			tags: ['Team'],
			body: {
				type: 'object',
				properties: {
					newMembers: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								_id: { type: 'string' },
								role: { type: 'string', enum: Object.values(TeamRoles) }
							},
							required: ['_id']
						}
					}
				},
				required: ['newMembers']
			}
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamAdminRole)
		],
		preHandler: loadTeamById,
		handler: async function (req, reply) {
			await Promise.all(
				req.body.newMembers
					.filter((member) => null != member._id)
					.map(async (member) => {
						const user = await userService.read(member._id);
						if (null != user) {
							await teamsService.addMemberToTeam(user, req.team, member.role);
							return auditService.audit(
								`team ${member.role} added`,
								'team-role',
								'user add',
								req,
								req.team.auditCopyTeamMember(user, member.role)
							);
						}
					})
			);
			return reply.send();
		}
	});

	fastify.route({
		method: 'POST',
		url: '/team/:id/members',
		schema: {
			description: 'Searches for members of a Team',
			tags: ['Team'],
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamMemberRole)
		],
		preHandler: loadTeamById,
		handler: async function (req, reply) {
			// Get search and query parameters
			const search = req.body.s ?? '';
			const query = teamsService.updateMemberFilter(
				utilService.toMongoose(req.body.q ?? {}),
				req.team
			);

			const results = await userService.searchUsers(req.query, query, search);

			// Create the return copy of the messages
			const mappedResults = {
				pageNumber: results.pageNumber,
				pageSize: results.pageSize,
				totalPages: results.totalPages,
				totalSize: results.totalSize,
				elements: results.elements.map((element) => {
					return {
						...element.filteredCopy(),
						teams: element.teams.filter((team) => team._id.equals(req.team._id))
					};
				})
			};

			return reply.send(mappedResults);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/team/:id/member/:memberId',
		schema: {
			description: 'Adds a member to a Team',
			tags: ['Team'],
			body: {
				type: 'object',
				properties: {
					role: {
						type: 'string',
						enum: Object.values(TeamRoles)
					}
				},
				required: ['role']
			}
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamAdminRole)
		],
		preHandler: [loadTeamById, loadTeamMemberById],
		handler: async function (req, reply) {
			const role: TeamRoles = req.body.role ?? TeamRoles.Member;

			await teamsService.addMemberToTeam(req.userParam, req.team, role);

			// Audit the member add request
			await auditService.audit(
				`team ${role} added`,
				'team-role',
				'user add',
				req,
				req.team.auditCopyTeamMember(req.userParam, role)
			);

			return reply.send();
		}
	});

	fastify.route({
		method: 'DELETE',
		url: '/team/:id/member/:memberId',
		schema: {
			description: 'Deletes a member from a Team',
			tags: ['Team']
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamAdminRole)
		],
		preHandler: [loadTeamById, loadTeamMemberById],
		handler: async function (req, reply) {
			await teamsService.removeMemberFromTeam(req.userParam, req.team);

			// Audit the user remove
			await auditService.audit(
				'team member removed',
				'team-role',
				'user remove',
				req,
				req.team.auditCopyTeamMember(req.userParam)
			);

			return reply.send();
		}
	});

	fastify.route({
		method: 'POST',
		url: '/team/:id/member/:memberId/role',
		schema: {
			description: `Updates a member's role in a team`,
			tags: ['Team'],
			body: {
				type: 'object',
				properties: {
					role: {
						type: 'string',
						enum: Object.values(TeamRoles)
					}
				},
				required: ['role']
			}
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamAdminRole)
		],
		preHandler: [loadTeamById, loadTeamMemberById],
		handler: async function (req, reply) {
			const role: TeamRoles = req.body.role || TeamRoles.Member;

			await teamsService.updateMemberRole(req.userParam, req.team, role);

			// Audit the member update request
			await auditService.audit(
				`team role changed to ${role}`,
				'team-role',
				'user add',
				req,
				req.team.auditCopyTeamMember(req.userParam, role)
			);

			return reply.send();
		}
	});
}

async function loadTeamById(req: FastifyRequest) {
	const id = req.params['id'];
	const populate = [
		{
			path: 'parent',
			select: ['name']
		},
		{
			path: 'ancestors',
			select: ['name']
		}
	];

	req.team = await teamsService.read(id, populate);
	if (!req.team) {
		throw new NotFoundError('Could not find team');
	}
}

async function loadTeamMemberById(req: FastifyRequest) {
	const id = req.params['memberId'];
	req.userParam = await userService.read(id);

	if (!req.userParam) {
		throw new Error('Failed to load team member');
	}
}
