import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance } from 'fastify';

import { metricsLogger } from '../../../lib/logger';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'GET',
		url: '/client-metrics',
		schema: {
			hide: true
		},
		handler: function (req, reply) {
			metricsLogger.log('', { metricsEvent: req.body });
			return reply.send();
		}
	});
}
