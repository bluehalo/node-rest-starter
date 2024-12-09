import { Type, TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';

import accessCheckerService from './access-checker.service';
import cacheEntryService from './cache/cache-entry.service';
import { PagingQueryStringType, SearchBodyType } from '../core.types';
import { requireAdminAccess, requireLogin } from '../user/auth/auth.hooks';

const KeyParamsType = Type.Object({
	key: Type.String()
});

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();

	fastify.route({
		method: 'POST',
		url: '/access-checker/entries/match',
		schema: {
			description: 'Search cache entries',
			tags: ['Access Checker'],
			body: SearchBodyType,
			querystring: PagingQueryStringType
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const results = await cacheEntryService.search(
				req.query,
				req.body.s,
				req.body.q
			);

			// Create the return copy of the messages
			const mappedResults = {
				pageNumber: results.pageNumber,
				pageSize: results.pageSize,
				totalPages: results.totalPages,
				totalSize: results.totalSize,
				elements: results.elements.map((element) => element.fullCopy())
			};

			return reply.send(mappedResults);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/access-checker/entry/:key',
		schema: {
			description: 'Trigger cache entry refresh',
			tags: ['Access Checker'],
			params: KeyParamsType
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			await accessCheckerService.refreshEntry(req.params.key);
			return reply.send();
		}
	});

	fastify.route({
		method: 'DELETE',
		url: '/access-checker/entry/:key',
		schema: {
			description: 'Delete cache entry',
			tags: ['Access Checker'],
			params: KeyParamsType
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			await cacheEntryService.delete(req.params.key);
			return reply.send();
		}
	});

	fastify.route({
		method: 'POST',
		url: '/access-checker/user',
		schema: {
			description: 'Refresh cache entry',
			tags: ['Access Checker']
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			await accessCheckerService.refreshEntry(
				req.user.providerData?.dnLower as string
			);
			return reply.send();
		}
	});
}
