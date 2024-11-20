import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance } from 'fastify';
import _ from 'lodash';
import { FilterQuery } from 'mongoose';

import { Audit, AuditDocument } from './audit.model';
import { config, utilService as util } from '../../../dependencies';
import { PagingQueryStringSchema, SearchBodySchema } from '../core.schemas';
import { Callbacks } from '../export/callbacks';
import * as exportConfigController from '../export/export-config.controller';
import { loadExportConfigById } from '../export/export-config.controller';
import { requireAuditorAccess } from '../user/auth/auth.middleware';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'GET',
		url: '/audit/distinctValues',
		schema: {
			description:
				'Retrieves the distinct values for a field in the Audit collection',
			tags: ['Audit'],
			querystring: {
				type: 'object',
				properties: {
					field: { type: 'string' }
				},
				required: ['field']
			}
		},
		preValidation: requireAuditorAccess,
		handler: async function (req, reply) {
			const results = await Audit.distinct(req.query.field, {});
			return reply.send(results);
		}
	});

	fastify.route({
		method: 'POST',
		url: '/audit',
		schema: {
			description: 'Returns audit records matching search criteria',
			tags: ['Audit'],
			body: SearchBodySchema,
			querystring: PagingQueryStringSchema
		},
		preValidation: requireAuditorAccess,
		handler: async function (req, reply) {
			const search = req.body.s ?? null;
			let query: Record<string, unknown> = req.body.q ?? {};
			query = util.toMongoose(query) as Record<string, unknown>;

			const page = util.getPage(req.query);
			const limit = util.getLimit(req.query);
			const sort = util.getSortObj(req.query, 'DESC', '_id');

			const result = await Audit.find(query)
				.containsSearch(search)
				.sort(sort)
				.paginate(limit, page);

			// If any audit objects are strings, try to parse them as json. we may have stringified objects because mongo
			// can't support keys with dots
			result.elements = result.elements.map((doc) => {
				if (_.isString(doc.audit.object)) {
					try {
						doc.audit.object = JSON.parse(doc.audit.object);
						return doc;
					} catch (e) {
						// ignore
						return doc;
					}
				}
				return doc;
			});

			// Serialize the response
			return reply.send(result);
		}
	});

	fastify.route({
		method: 'GET',
		url: '/audit/csv/:id',
		schema: {
			description: 'Export audit records as CSV file',
			tags: ['Audit']
		},
		preValidation: requireAuditorAccess,
		preHandler: loadExportConfigById,
		handler: function (req, reply) {
			const exportConfig = req.exportConfig;
			const exportQuery = util.toMongoose(
				req.exportQuery
			) as FilterQuery<AuditDocument>;

			const fileName = `${config.get('app.instanceName')}-${
				exportConfig.type
			}.csv`;

			const columns = exportConfig.config.cols;

			columns.forEach((col) => {
				col.title = col.title ?? _.capitalize(col.key);

				switch (col.key) {
					case 'created':
						col.callback = Callbacks.formatDate(`yyyy-LL-dd HH:mm:ss`);
						break;
					case 'audit.actor':
						col.callback = Callbacks.getValueProperty('name');
						break;
				}
			});

			const sort = util.getSortObj(exportConfig.config, 'DESC', '_id');

			const cursor = Audit.find(exportQuery)
				.containsSearch(exportConfig.config.s)
				.sort(sort)
				.cursor();

			exportConfigController.exportCSV(req, reply, fileName, columns, cursor);
		}
	});
}
