import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { FilterQuery } from 'mongoose';

import { FeedbackDocument, FeedbackType, Statuses } from './feedback.model';
import feedbackService from './feedback.service';
import {
	FeedbackSetAssigneeType,
	FeedbackSetStatusType
} from './feedback.types';
import { config } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';
import { audit } from '../audit/audit.hooks';
import {
	IdParamsType,
	PagingQueryStringType,
	SearchBodyType
} from '../core.types';
import { Callbacks } from '../export/callbacks';
import * as exportConfigController from '../export/export-config.controller';
import { loadExportConfigById } from '../export/export-config.controller';
import { IExportConfig } from '../export/export-config.model';
import { requireAdminAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();
	fastify.route({
		method: 'POST',
		url: '/admin/feedback',
		schema: {
			description: 'returns feedback matching search criteria',
			tags: ['Feedback'],
			body: SearchBodyType,
			querystring: PagingQueryStringType
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
			body: FeedbackSetStatusType,
			params: IdParamsType,
			response: {
				200: FeedbackType
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

			const updatedFeedback = await feedbackService.updateFeedbackStatus(
				feedback,
				req.body.status as Statuses
			);
			return reply.send(updatedFeedback);
		},
		preSerialization: audit({
			message: 'Feedback status updated',
			type: 'feedback',
			action: 'update'
		})
	});

	fastify.route({
		method: 'PATCH',
		url: '/admin/feedback/:id/assignee',
		schema: {
			description: ' Updates the assignee of the feedback with the supplied ID',
			tags: ['Feedback'],
			body: FeedbackSetAssigneeType,
			params: IdParamsType,
			response: {
				200: FeedbackType
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

			const updatedFeedback = await feedbackService.updateFeedbackAssignee(
				feedback,
				req.body.assignee
			);
			return reply.send(updatedFeedback);
		},
		preSerialization: audit({
			message: 'Feedback assignee updated',
			type: 'feedback',
			action: 'update'
		})
	});

	fastify.route({
		method: 'GET',
		url: '/admin/feedback/csv/:id',
		schema: {
			description: 'Export feedback as CSV file',
			tags: ['Feedback'],
			params: IdParamsType
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
			for (const col of columns) {
				col.title = col.title ?? _.capitalize(col.key);

				switch (col.key) {
					case 'created':
					case 'updated': {
						col.callback = Callbacks.isoDateString;
						break;
					}
				}
			}

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

			return reply;
		}
	});
}
