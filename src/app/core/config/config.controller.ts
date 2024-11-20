import { FastifyInstance } from 'fastify';

import configService from './config.service';

export default function (fastify: FastifyInstance) {
	// For now, just a single get for the global client configuration
	fastify.route({
		method: 'GET',
		url: '/config',
		schema: {
			hide: true
		},
		handler: function (request, reply) {
			return reply.send(configService.getSystemConfig());
		}
	});
}
