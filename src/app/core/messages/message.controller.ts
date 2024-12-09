import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';

import { DismissMessagesType } from './message.types';
import messageService from './messages.service';
import { auditService } from '../../../dependencies';
import { PagingQueryStringType, SearchBodyType } from '../core.types';
import { requireAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/messages',
		schema: {
			description: 'Return messages matching search criteria',
			tags: ['Messages'],
			body: SearchBodyType,
			querystring: PagingQueryStringType
		},
		preValidation: requireAccess,
		handler: async function (req, reply) {
			const results = await messageService.search(
				req.query,
				req.body.s,
				req.body.q
			);

			return reply.send(results);
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
			body: DismissMessagesType
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
}
