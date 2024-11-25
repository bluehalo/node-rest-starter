import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance } from 'fastify';

import notificationsService from './notification.service';
import { PagingQueryStringSchema, SearchBodySchema } from '../core.schemas';
import { requireAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'POST',
		url: '/notifications',
		schema: {
			hide: true,
			description: '',
			tags: ['Notifications'],
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			// Get search and query parameters
			const query = req.body.q ?? {};

			// Always need to filter by user making the service call
			query.user = req.user._id;

			const result = await notificationsService.search(req.query, query);
			return reply.send(result);
		}
	});
}
