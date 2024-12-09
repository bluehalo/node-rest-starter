import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';

import { requireTeamAdminRole, requireTeamMemberRole } from './team-auth.hooks';
import { TeamRoles } from './team-role.model';
import { loadTeamById, loadTeamMemberById } from './team.hooks';
import {
	AddTeamMembersType,
	IdAndMemberIdParamsType,
	TeamMemberRoleType
} from './team.types';
import teamsService from './teams.service';
import { utilService, auditService } from '../../../dependencies';
import {
	IdParamsType,
	PagingQueryStringType,
	SearchBodyType
} from '../core.types';
import {
	requireAccess,
	requireAdminRole,
	requireAny
} from '../user/auth/auth.hooks';
import userService from '../user/user.service';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'PUT',
		url: '/team/:id/members',
		schema: {
			description: 'Adds members to a Team',
			tags: ['Team'],
			body: AddTeamMembersType,
			params: IdParamsType
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
			body: SearchBodyType,
			querystring: PagingQueryStringType,
			params: IdParamsType
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
			body: TeamMemberRoleType,
			params: IdAndMemberIdParamsType
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
			tags: ['Team'],
			params: IdAndMemberIdParamsType
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
			body: TeamMemberRoleType,
			params: IdAndMemberIdParamsType
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
