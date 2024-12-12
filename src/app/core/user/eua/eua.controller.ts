import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance, FastifyRequest } from 'fastify';

import euaService from './eua.service';
import { audit, auditTrackBefore } from '../../audit/audit.hooks';
import {
	IdParamsType,
	PagingQueryStringType,
	SearchBodyType
} from '../../core.types';
import { requireAdminAccess, requireLogin } from '../auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/euas',
		schema: {
			description: 'Returns EUAs matching search criteria',
			tags: ['EUA'],
			body: SearchBodyType,
			querystring: PagingQueryStringType
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			// Handle the query/search
			const query = req.body.q ?? {};
			const search = req.body.s ?? null;

			const results = await euaService.search(req.query, search, query);
			return reply.send(results);
		}
	});

	fastify.route({
		method: 'GET',
		url: '/eua',
		schema: {
			description: 'Retrieve current system EUA',
			tags: ['EUA']
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			const result = await euaService.getCurrentEua();
			return reply.send(result);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/eua',
		schema: {
			description: 'Create EUA',
			tags: ['EUA']
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const result = await euaService.create(req.body);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'eua create',
			type: 'eua',
			action: 'create'
		})
	});

	fastify.route({
		method: 'POST',
		url: '/eua/accept',
		schema: {
			description: 'Accept EUA for current user',
			tags: ['EUA']
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			const user = await euaService.acceptEua(req.user);
			return reply.send(user.fullCopy());
		},
		preSerialization: audit({
			message: 'eua accepted',
			type: 'eua',
			action: 'update'
		})
	});

	fastify.route({
		method: 'GET',
		url: '/eua/:id',
		schema: {
			description: 'Retrieve EUA details',
			tags: ['EUA'],
			params: IdParamsType
		},
		preValidation: requireAdminAccess,
		preHandler: loadEuaById,
		handler: function (req, reply) {
			return reply.send(req.euaParam);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/eua/:id',
		schema: {
			description: 'Update EUA details',
			tags: ['EUA'],
			params: IdParamsType
		},
		preValidation: requireAdminAccess,
		preHandler: [loadEuaById, auditTrackBefore('euaParam')],
		handler: async function (req, reply) {
			const result = await euaService.update(req.euaParam, req.body);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'end user agreement updated',
			type: 'eua',
			action: 'update'
		})
	});

	fastify.route({
		method: 'DELETE',
		url: '/eua/:id',
		schema: {
			description: '',
			tags: ['EUA'],
			params: IdParamsType
		},
		preValidation: requireAdminAccess,
		preHandler: loadEuaById,
		handler: async function (req, reply) {
			const result = await euaService.delete(req.euaParam);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'eua deleted',
			type: 'eua',
			action: 'delete'
		})
	});

	fastify.route({
		method: 'POST',
		url: '/eua/:id/publish',
		schema: {
			description: '',
			tags: ['EUA'],
			params: IdParamsType
		},
		preValidation: requireAdminAccess,
		preHandler: loadEuaById,
		handler: async function (req, reply) {
			// The eua is placed into this parameter by the middleware
			const eua = req.euaParam;

			const result = await euaService.publishEua(eua);

			return reply.send(result);
		},
		preSerialization: audit({
			message: 'eua published',
			type: 'eua',
			action: 'published'
		})
	});
}

async function loadEuaById(req: FastifyRequest) {
	const params = req.params as { id: string };
	const id = params['id'];
	req.euaParam = await euaService.read(id);
	if (!req.euaParam) {
		throw new Error(`Failed to load User Agreement ${id}`);
	}
}
