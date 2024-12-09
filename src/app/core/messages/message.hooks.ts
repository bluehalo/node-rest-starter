import { FastifyRequest } from 'fastify';

import messageService from './messages.service';
import { NotFoundError } from '../../common/errors';

export async function loadMessageById(req: FastifyRequest) {
	const id = req.params['id'];

	req.message = await messageService.read(id);
	if (!req.message) {
		throw new NotFoundError(`Failed to load message: ${id}`);
	}
}
