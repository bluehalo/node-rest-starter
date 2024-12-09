import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';

import { loadMessageById } from './message.hooks';
import { MessageType } from './message.model';
import { CreateMessageType } from './message.types';
import messageService from './messages.service';
import { audit, auditTrackBefore } from '../audit/audit.hooks';
import { IdParamsType } from '../core.types';
import { requireAdminAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/admin/message',
		schema: {
			description: 'Create a new message',
			tags: ['Messages'],
			body: CreateMessageType,
			response: {
				200: MessageType
			}
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
			params: IdParamsType,
			response: {
				200: MessageType
			}
		},
		preValidation: requireAdminAccess,
		// eslint-disable-next-line require-await
		handler: async function (req, reply) {
			return reply.send(req.message);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/admin/message/:id',
		schema: {
			description: 'Update message details',
			tags: ['Messages'],
			body: MessageType,
			params: IdParamsType,
			response: {
				200: MessageType
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
			params: IdParamsType,
			response: {
				200: MessageType
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
