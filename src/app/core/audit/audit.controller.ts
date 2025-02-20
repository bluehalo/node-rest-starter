import { Type, TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify';
import _ from 'lodash';

import { Audit, AuditDocument, AuditType } from './audit.model';
import { config, utilService as util } from '../../../dependencies';
import {
	PagingQueryStringType,
	PagingResultsType,
	SearchBodyType
} from '../core.types';
import { Callbacks } from '../export/callbacks';
import * as exportConfigController from '../export/export-config.controller';
import { loadExportConfigById } from '../export/export-config.controller';
import { requireAuditorAccess } from '../user/auth/auth.hooks';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<TypeBoxTypeProvider>();

	fastify.route({
		method: 'POST',
		url: '/audit',
		schema: {
			description: 'Returns audit records matching search criteria',
			tags: ['Audit'],
			hide: true,
			body: SearchBodyType,
			querystring: PagingQueryStringType,
			response: {
				200: PagingResultsType(AuditType)
			}
		},
		preValidation: requireAuditorAccess,
		handler: async function (req, reply) {
			const search = req.body.s ?? null;
			const query = util.toMongoose<AuditDocument>(req.body.q ?? {});

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
					} catch {
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
		url: '/audit/distinctValues',
		schema: {
			description:
				'Retrieves the distinct values for a field in the Audit collection',
			tags: ['Audit'],
			hide: true,
			querystring: Type.Object({
				field: Type.String()
			})
		},
		preValidation: requireAuditorAccess,
		handler: async function (req, reply) {
			const results = await Audit.distinct(req.query.field, {});
			return reply.send(results);
		}
	});

	fastify.route({
		method: 'GET',
		url: '/audit/csv/:id',
		schema: {
			description: 'Export audit records as CSV file',
			tags: ['Audit'],
			hide: true,
			params: Type.Object({
				id: Type.String()
			})
		},
		preValidation: requireAuditorAccess,
		preHandler: loadExportConfigById,
		handler: function (req, reply) {
			const exportConfig = req.exportConfig;
			const exportQuery = util.toMongoose<AuditDocument>(req.exportQuery);

			const fileName = `${config.get('app.instanceName')}-${
				exportConfig.type
			}.csv`;

			const columns = exportConfig.config.cols;

			for (const col of columns) {
				col.title = col.title ?? _.capitalize(col.key);

				switch (col.key) {
					case 'created': {
						col.callback = Callbacks.formatDate(`yyyy-LL-dd HH:mm:ss`);
						break;
					}
					case 'audit.actor': {
						col.callback = Callbacks.getValueProperty('name');
						break;
					}
				}
			}

			const sort = util.getSortObj(exportConfig.config, 'DESC', '_id');

			const cursor = Audit.find(exportQuery)
				.containsSearch(exportConfig.config.s)
				.sort(sort)
				.cursor();

			exportConfigController.exportCSV(req, reply, fileName, columns, cursor);

			return reply;
		}
	});
}
