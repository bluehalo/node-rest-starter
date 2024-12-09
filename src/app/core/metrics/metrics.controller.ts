import { FastifyInstance } from 'fastify';

import { metricsLogger } from '../../../lib/logger';

export default function (fastify: FastifyInstance) {
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
