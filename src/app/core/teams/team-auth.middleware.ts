import { FastifyReply, FastifyRequest } from 'fastify';

import { TeamRoles } from './team-role.model';
import teamsService from './teams.service';
import { BadRequestError } from '../../common/errors';
import { AuthRequirementFunction } from '../user/auth/auth.middleware';

export function requireTeamRole(role: TeamRoles): AuthRequirementFunction {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	return function (req: FastifyRequest, rep: FastifyReply): Promise<void> {
		req.log.debug('Executing auth middleware: requireTeamRoles');

		// Verify that the user and team are on the request
		const user = req.user;
		if (null == user) {
			return Promise.reject(new BadRequestError('No user for request'));
		}
		const team = req.team;
		if (null == team) {
			return Promise.reject(new BadRequestError('No team for request'));
		}

		return teamsService.meetsRoleRequirement(user, team, role);
	};
}

export const requireTeamAdminRole = requireTeamRole(TeamRoles.Admin);
export const requireTeamEditorRole = requireTeamRole(TeamRoles.Editor);
export const requireTeamMemberRole = requireTeamRole(TeamRoles.Member);
