import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';
import { FilterQuery } from 'mongoose';

import { INotification } from './notification.model';
import notificationsService from './notification.service';
import { PagingQueryStringType, SearchBodyType } from '../core.types';
import { requireAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/notifications',
		schema: {
			hide: true,
			description: '',
			tags: ['Notifications'],
			body: SearchBodyType,
			querystring: PagingQueryStringType
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			// Get search and query parameters
			const query: FilterQuery<INotification> = req.body.q ?? {};

			// Always need to filter by user making the service call
			query.user = req.user._id;

			const result = await notificationsService.search(req.query, query);
			return reply.send(result);
		}
	});
}
