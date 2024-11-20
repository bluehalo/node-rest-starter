import { FastifyReply, FastifyRequest } from 'fastify';

import euaService from './eua.service';
import { ForbiddenError } from '../../../common/errors';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireEua(req: FastifyRequest, rep: FastifyReply) {
	const result = await euaService.getCurrentEua();

	// Compare the current eua to the user's acceptance state
	if (
		null == result?.published ||
		(req.user.acceptedEua && req.user.acceptedEua >= result.published)
	) {
		// if the user's acceptance is valid, then proceed
		return Promise.resolve();
	}
	// return Promise.resolve();
	return Promise.reject(
		new ForbiddenError('User must accept end-user agreement.')
	);
}
