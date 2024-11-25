import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance, FastifyRequest } from 'fastify';

import messageService from './messages.service';
import { auditService } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';
import { audit, auditTrackBefore } from '../audit/audit.hooks';
import { PagingQueryStringSchema, SearchBodySchema } from '../core.schemas';
import { requireAccess, requireAdminAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'POST',
		url: '/messages',
		schema: {
			description: '',
			tags: ['Messages'],
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			const results = await messageService.search(
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
		url: '/messages/recent',
		schema: {
			description: 'Retrieve list of recent messages',
			tags: ['Messages']
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			const result = await messageService.getRecentMessages(req.user._id);
			return reply.send(result);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/messages/dismiss',
		schema: {
			description: 'Dismiss messages',
			tags: ['Messages'],
			body: {
				type: 'object',
				properties: {
					messageIds: {
						type: 'array',
						items: {
							type: 'string'
						}
					}
				}
			}
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			const dismissedMessages = await messageService.dismissMessages(
				req.body.messageIds,
				req.user
			);

			// Audit dismissal of messages
			for (const dismissedMessage of dismissedMessages) {
				auditService
					.audit(
						'message dismissed',
						'message',
						'dismissed',
						req,
						dismissedMessage.auditCopy()
					)
					.then();
			}

			return reply.send(dismissedMessages);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/admin/message',
		schema: {
			description: 'Create a new message',
			tags: ['Messages']
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const message = await messageService.create(req.user, req.body);

			// Publish the message
			messageService.publishMessage(message).then();

			return reply.send(message);
		},
		preSerialization: audit({
			message: 'message created',
			type: 'message',
			action: 'create'
		})
	});

	fastify.route({
		method: 'GET',
		url: '/admin/message/:id',
		schema: {
			description: '',
			tags: ['Messages'],
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: requireAdminAccess,
		handler: function (req, reply) {
			return reply.send(req.message);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/admin/message/:id',
		schema: {
			description: 'Update message details',
			tags: ['Messages'],
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: requireAdminAccess,
		preHandler: [loadMessageById, auditTrackBefore('message')],
		handler: async function (req, reply) {
			const result = await messageService.update(req.message, req.body);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'message updated',
			type: 'message',
			action: 'update'
		})
	});

	fastify.route({
		method: 'DELETE',
		url: '/admin/message/:id',
		schema: {
			description: '',
			tags: ['Messages'],
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: requireAdminAccess,
		preHandler: loadMessageById,
		handler: async function (req, reply) {
			const result = await messageService.delete(req.message);
			return reply.send(result);
		},
		preSerialization: audit({
			message: 'message deleted',
			type: 'message',
			action: 'delete'
		})
	});
}

async function loadMessageById(req: FastifyRequest) {
	const id = req.params['id'];

	req.message = await messageService.read(id);
	if (!req.message) {
		throw new NotFoundError(`Failed to load message: ${id}`);
	}
}
