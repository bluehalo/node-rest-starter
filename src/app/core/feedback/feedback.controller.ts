import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { FilterQuery } from 'mongoose';

import { FeedbackDocument, Statuses } from './feedback.model';
import feedbackService from './feedback.service';
import { auditService, config } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';
import { PagingQueryStringSchema, SearchBodySchema } from '../core.schemas';
import { Callbacks } from '../export/callbacks';
import * as exportConfigController from '../export/export-config.controller';
import { loadExportConfigById } from '../export/export-config.controller';
import { IExportConfig } from '../export/export-config.model';
import { requireLogin, requireAdminAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'POST',
		url: '/feedback',
		schema: {
			description: 'Submit feedback to the system',
			tags: ['Feedback'],
			body: {
				type: 'object',
				properties: {
					body: {
						type: 'string',
						title: 'Body',
						description: 'Body of the feedback',
						examples: ['This application is great!']
					},
					type: {
						type: 'string',
						title: 'Type',
						description: 'type/category of the feedback',
						examples: ['general feedback']
					},
					url: {
						type: 'string',
						title: 'URL',
						description: 'url from which the feedback was submitted',
						examples: ['http://localhost/#/home']
					},
					classification: {
						type: 'string',
						title: 'Classification',
						description: 'Classification level of the feedback',
						examples: ['class1']
					}
				},
				required: ['body', 'type', 'url']
			}
		},
		preValidation: requireLogin,
		handler: async function (req, reply) {
			const audit = await auditService.audit(
				'Feedback submitted',
				'feedback',
				'create',
				req,
				req.body
			);
			const feedback = await feedbackService.create(
				req.user,
				req.body,
				audit.audit.userSpec
			);
			await feedbackService.sendFeedbackEmail(req.user, feedback, req);

			return reply.send(feedback);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/admin/feedback',
		schema: {
			description: 'returns feedback matching search criteria',
			tags: ['Feedback'],
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const results = await feedbackService.search(
				req.query,
				req.body.s,
				req.body.q,
				{
					path: 'creator',
					select: ['username', 'organization', 'name', 'email']
				}
			);
			return reply.send(results);
		}
	});

	fastify.route({
		method: 'PATCH',
		url: '/admin/feedback/:id/status',
		schema: {
			description: 'Updates the status of the feedback with the supplied ID',
			tags: ['Feedback'],
			body: {
				type: 'object',
				properties: {
					status: { type: 'string', enum: ['New', 'Open', 'Closed'] }
				},
				required: ['status']
			},
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const populate = [
				{
					path: 'creator',
					select: ['username', 'organization', 'name', 'email']
				}
			];

			const feedback = await feedbackService.read(req.params.id, populate);
			if (!feedback) {
				throw new NotFoundError('Could not find feedback');
			}

			// Audit feedback status update
			await auditService.audit(
				'Feedback status updated',
				'feedback',
				'update',
				req,
				req.body
			);

			const updatedFeedback = await feedbackService.updateFeedbackStatus(
				feedback,
				req.body.status as Statuses
			);
			return reply.send(updatedFeedback);
		}
	});

	fastify.route({
		method: 'PATCH',
		url: '/admin/feedback/:id/assignee',
		schema: {
			description: ' Updates the assignee of the feedback with the supplied ID',
			tags: ['Feedback'],
			body: {
				type: 'object',
				properties: {
					assignee: { type: 'string' }
				},
				required: ['assignee']
			},
			params: {
				type: 'object',
				properties: {
					id: { type: 'string' }
				},
				required: ['id']
			}
		},
		preValidation: requireAdminAccess,
		handler: async function (req, reply) {
			const populate = [
				{
					path: 'creator',
					select: ['username', 'organization', 'name', 'email']
				}
			];

			const feedback = await feedbackService.read(req.params.id, populate);
			if (!feedback) {
				throw new NotFoundError('Could not find feedback');
			}

			// Audit feedback assignee update
			await auditService.audit(
				'Feedback assignee updated',
				'feedback',
				'update',
				req,
				req.body
			);

			const updatedFeedback = await feedbackService.updateFeedbackAssignee(
				feedback,
				req.body.assignee
			);
			return reply.send(updatedFeedback);
		}
	});

	fastify.route({
		method: 'GET',
		url: '/admin/feedback/csv/:id',
		schema: {
			description: 'Export feedback as CSV file',
			tags: ['Feedback']
		},
		preValidation: requireAdminAccess,
		preHandler: loadExportConfigById,
		handler: function (req, reply) {
			const exportConfig = req.exportConfig as IExportConfig;
			const exportQuery = req.exportQuery as FilterQuery<FeedbackDocument>;

			const fileName = `${config.get('app.instanceName')}-${
				exportConfig.type
			}.csv`;

			const columns = exportConfig.config.cols;
			// Based on which columns are requested, handle property-specific behavior (ex. callbacks for the
			// CSV service to make booleans and dates more human-readable)
			columns.forEach((col) => {
				col.title = col.title ?? _.capitalize(col.key);

				switch (col.key) {
					case 'created':
					case 'updated':
						col.callback = Callbacks.isoDateString;
						break;
				}
			});

			const cursor = feedbackService.cursorSearch(
				exportConfig.config,
				exportConfig.config.s,
				exportQuery,
				{
					path: 'creator',
					select: ['username', 'organization', 'name', 'email']
				}
			);

			exportConfigController.exportCSV(req, reply, fileName, columns, cursor);
		}
	});
}
