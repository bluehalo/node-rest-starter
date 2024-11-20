import { FastifyInstance } from 'fastify';

export default function (fastify: FastifyInstance) {
	fastify.route({
		method: 'GET',
		url: '/test',
		handler: function (req, reply) {
			return reply.send({ message: 'hello world' });
		}
	});
}
