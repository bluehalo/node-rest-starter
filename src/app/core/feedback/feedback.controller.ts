import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';

import { FeedbackType } from './feedback.model';
import feedbackService from './feedback.service';
import { CreateFeedbackType } from './feedback.types';
import { utilService } from '../../../dependencies';
import { audit } from '../audit/audit.hooks';
import { requireLogin } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/feedback',
		schema: {
			description: 'Submit feedback to the system',
			tags: ['Feedback'],
			body: CreateFeedbackType,
			response: {
				200: FeedbackType
			}
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			const userAgentObj = utilService.getUserAgentFromHeader(req.headers);
			const feedback = await feedbackService.create(
				req.user,
				req.body,
				userAgentObj
			);
			await feedbackService.sendFeedbackEmail(req.user, feedback, req);
			return reply.send(feedback);
		},
		preSerialization: audit({
			message: 'Feedback submitted',
			type: 'feedback',
			action: 'create'
		})
	});
}
