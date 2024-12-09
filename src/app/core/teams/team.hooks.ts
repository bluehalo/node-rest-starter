import { FastifyRequest } from 'fastify';

import teamsService from './teams.service';
import { NotFoundError } from '../../common/errors';
import userService from '../user/user.service';

export async function loadTeamById(req: FastifyRequest) {
	const id = req.params['id'];
	const populate = [
		{ path: 'parentObj', select: ['name'] },
		{ path: 'ancestorObjs', select: ['name'] }
	];

	req.team = await teamsService.read(id, populate);
	if (!req.team) {
		throw new NotFoundError('Could not find team');
	}
}

export async function loadTeamMemberById(req: FastifyRequest) {
	const id = req.params['memberId'];
	req.userParam = await userService.read(id);

	if (!req.userParam) {
		throw new Error('Failed to load team member');
	}
}
