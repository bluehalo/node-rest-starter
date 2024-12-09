import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';

import { requireTeamAdminRole, requireTeamMemberRole } from './team-auth.hooks';
import { loadTeamById } from './team.hooks';
import { TeamType } from './team.model';
import { CreateTeamType, RequestTeamType, UpdateTeamType } from './team.types';
import teamsService from './teams.service';
import { utilService, auditService } from '../../../dependencies';
import { audit, auditTrackBefore } from '../audit/audit.hooks';
import {
	IdParamsType,
	PagingQueryStringType,
	PagingResultsType,
	SearchBodyType
} from '../core.types';
import {
	requireAccess,
	requireAdminRole,
	requireAny,
	requireEditorAccess
} from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/team',
		schema: {
			description: 'Creates a new Team',
			tags: ['Team'],
			body: CreateTeamType,
			response: {
				200: TeamType
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
			body: SearchBodyType,
			querystring: PagingQueryStringType,
			response: {
				200: PagingResultsType(TeamType)
			}
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
			params: IdParamsType,
			tags: ['Team'],
			response: {
				200: TeamType
			}
		},
		preValidation: [
			requireAccess,
			requireAny(requireAdminRole, requireTeamMemberRole)
		],
		preHandler: loadTeamById,
		// eslint-disable-next-line require-await
		handler: async function (req, reply) {
			return reply.send(req.team);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/team/:id',
		schema: {
			description: 'Updates the details of a Team',
			tags: ['Team'],
			params: IdParamsType,
			body: UpdateTeamType,
			response: {
				200: TeamType
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
			params: IdParamsType,
			response: {
				200: TeamType
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
			tags: ['Team'],
			params: IdParamsType
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
			body: RequestTeamType
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
}
