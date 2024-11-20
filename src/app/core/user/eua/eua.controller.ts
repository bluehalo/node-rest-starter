import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance, FastifyRequest } from 'fastify';

import euaService from './eua.service';
import { auditService } from '../../../../dependencies';
import { PagingQueryStringSchema, SearchBodySchema } from '../../core.schemas';
import { requireAdminAccess, requireLogin } from '../auth/auth.middleware';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'POST',
		url: '/euas',
		schema: {
			description: 'Returns EUAs matching search criteria',
			tags: ['EUA'],
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
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

			// Audit eua create
			await auditService.audit(
				'eua create',
				'eua',
				'create',
				req,
				result.auditCopy()
			);

			return reply.send(result);
		}
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

			// Audit accepted eua
			auditService.audit('eua accepted', 'eua', 'accepted', req, {}).then();

			return reply.send(user.fullCopy());
		}
	});

	fastify.route({
		method: 'GET',
		url: '/eua/:id',
		schema: {
			description: 'Retrieve EUA details',
			tags: ['EUA']
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
			tags: ['Eua']
		},
		preValidation: requireAdminAccess,
		preHandler: loadEuaById,
		handler: async function (req, reply) {
			// A copy of the original eua for auditing purposes
			const originalEua = req.euaParam.auditCopy();

			const result = await euaService.update(req.euaParam, req.body);

			// Audit user update
			await auditService.audit(
				'end user agreement updated',
				'eua',
				'update',
				req,
				{
					before: originalEua,
					after: result.auditCopy()
				}
			);

			return reply.send(result);
		}
	});

	fastify.route({
		method: 'DELETE',
		url: '/eua/:id',
		schema: {
			description: '',
			tags: ['EUA']
		},
		preValidation: requireAdminAccess,
		preHandler: loadEuaById,
		handler: async function (req, reply) {
			// The eua is placed into this parameter by the middleware
			const eua = req.euaParam;

			const result = await euaService.delete(eua);

			// Audit eua delete
			await auditService.audit(
				'eua deleted',
				'eua',
				'delete',
				req,
				eua.auditCopy()
			);

			return reply.send(result);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/eua/:id/publish',
		schema: {
			description: '',
			tags: ['EUA']
		},
		preValidation: requireAdminAccess,
		preHandler: loadEuaById,
		handler: async function (req, reply) {
			// The eua is placed into this parameter by the middleware
			const eua = req.euaParam;

			const result = await euaService.publishEua(eua);

			// Audit eua create
			await auditService.audit(
				'eua published',
				'eua',
				'published',
				req,
				result.auditCopy()
			);

			return reply.send(result);
		}
	});
}

async function loadEuaById(req: FastifyRequest) {
	const id = req.params['id'];
	req.euaParam = await euaService.read(id);
	if (!req.euaParam) {
		throw new Error(`Failed to load User Agreement ${id}`);
	}
}
