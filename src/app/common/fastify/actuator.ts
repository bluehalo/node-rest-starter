import { FastifyInstance } from 'fastify';

import pkg from '../../../../package.json';

export default function (instance: FastifyInstance) {
	instance.route({
		method: 'GET',
		url: '/health',
		schema: {
			hide: true
		},
		handler: function (_req, reply) {
			return reply.send({ status: 'UP' });
		}
	});

	instance.route({
		method: 'GET',
		url: '/info',
		schema: {
			hide: true
		},
		handler: function (_req, reply) {
			return reply.send({
				name: pkg.name,
				description: pkg.description,
				version: pkg.version
			});
		}
	});

	instance.route({
		method: 'GET',
		url: '/metrics',
		schema: {
			hide: true
		},
		handler: function (_req, reply) {
			return reply.send({
				mem: process.memoryUsage(),
				uptime: process.uptime()
			});
		}
	});
}
