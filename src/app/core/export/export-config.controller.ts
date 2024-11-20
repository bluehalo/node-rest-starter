import os from 'os';
import { Readable, Transform } from 'stream';

import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { ExportColumnDef } from './export-config.model';
import exportConfigService from './export-config.service';
import { auditService, csvStream } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';

export default function (_fastify: FastifyInstance) {
	const fastify = _fastify.withTypeProvider<JsonSchemaToTsProvider>();
	fastify.route({
		method: 'POST',
		url: '/requestExport',
		schema: {
			description:
				'Request to generate an export configuration in preparation to serve a file download soon.',
			tags: ['Export'],
			body: {
				type: 'object',
				properties: {
					type: { type: 'string' },
					config: {
						type: 'object',
						properties: {
							col: {
								type: 'object',
								properties: {
									key: { type: 'string' },
									title: { type: 'string' }
								},
								required: ['key']
							},
							s: { type: 'string' },
							q: { type: 'object' },
							sort: { type: 'string' },
							dir: {
								anyOf: [
									{ type: 'string', enum: ['ASC', 'DESC'] },
									{ type: 'integer', enum: [-1, 1] }
								]
							}
						}
					}
				},
				required: ['type']
			},
			response: {
				200: {
					description: 'Successful response',
					type: 'object',
					properties: {
						_id: { type: 'string' }
					}
				}
			}
		},
		handler: async function (req, reply) {
			const { q, ...config } = req.body.config;
			if (q) {
				// Stringify the query JSON because '$' is reserved in Mongo.
				config.q = JSON.stringify(req.body.config.q);
			}
			req.body.config = config;

			const generatedConfig = await exportConfigService.create(req.body);

			auditService
				.audit(
					`${req.body.type} config created`,
					'export',
					'create',
					req,
					generatedConfig.auditCopy()
				)
				.then();

			return reply.send({ _id: generatedConfig._id.toString() });
		}
	});
}

/**
 * Export a CSV file with rows derived from an array of objects or a readable stream
 *
 * @param req
 * @param reply
 * @param filename the name of the exported file
 * @param columns the columns to include in the exported CSV file
 * @param data an array of objects containing data for rows, or an instance of readable
 */
export const exportCSV = (
	req: FastifyRequest,
	reply: FastifyReply,
	filename: string,
	columns: ExportColumnDef[],
	data: Array<unknown> | Readable
) => {
	if (null !== data) {
		exportStream(
			req,
			reply,
			filename,
			'text/csv',
			buildCSVStream(data, columns)
		);
	}
};

/**
 * Export a plain text file with content derived from a string or a readable stream
 * @param req
 * @param res
 * @param filename the name of the exported file
 * @param text the text or readable stream to export
 */
export const exportPlaintext = (req, res, filename: string, text: string) => {
	if (null !== text) {
		exportStream(
			req,
			res,
			filename,
			'text/plain',
			buildExportStream(text, (stream) => () => {
				text.split(os.EOL).forEach((row) => {
					stream.push(row);
				});
				stream.push(null);
			})
		);
	}
};

export const buildCSVStream = (
	data: Readable | unknown,
	columns: ExportColumnDef[]
) => {
	return buildExportStream(
		data,
		(stream) => () => {
			if (Array.isArray(data)) {
				data.forEach((row) => {
					stream.push(row);
				});
			}
			stream.push(null);
		},
		[csvStream.streamToCsv(columns)]
	);
};

/**
 * Build a readable stream from data and pipe through a chain of transform streams
 *
 * @param data the data to be exported, either in the form of a readable stream or an object accompanied by a getRead function
 * @param {Function} getRead a function that takes a readable stream and returns the _read function for the new stream if data is not a readable stream
 * @param [transforms] an optional array of transform streams through which to pipe the export data
 */
const buildExportStream = (
	data: Readable | unknown,
	getRead: (unknown) => () => void,
	transforms: Transform[] = []
) => {
	let stream: Readable; // = data;

	if (data instanceof Readable) {
		stream = data;
	} else {
		stream = new Readable({ objectMode: true });
		stream._read = getRead(stream);
	}

	if (!stream.destroy) {
		stream.destroy = () => {
			stream.destroyed = true;
			return stream;
		};
	}

	if (transforms && transforms.length) {
		// reduce the initial stream and transform streams to a single stream
		// destroying the resulting stream will also destroy all of the transform streams and the initial streams
		stream = transforms.reduce((prevStream, transform) => {
			// pipe previous stream through current transform stream
			const newStream = prevStream.pipe(transform);

			// if the previous stream has a defined `destroy()` function, we need to combine it with the newStream's destroy function
			if (prevStream.destroy) {
				// save the potentially undefined `destroy()` function from the new stream
				const originalDestroy = newStream.destroy;

				// we need to destroy both the new stream and the previous stream here
				newStream.destroy = () => {
					// newStream had a `destroy()` function already defined, use it
					if (originalDestroy) {
						originalDestroy.apply(newStream);
					} else {
						// the new stream did not have a defined `destroy()` function,
						//  so we should mark it as `destroyed` at this point
						newStream.destroyed = true;
					}

					// now destroy the previous stream
					prevStream.destroy();
					return newStream;
				};
			}

			return newStream;
		}, stream);
	}

	return stream;
};

/**
 * Export to a file from a readable stream
 *
 * @param req
 * @param res
 * @param fileName
 * @param contentType
 * @param stream
 */
export const exportStream = (
	req: FastifyRequest,
	res: FastifyReply,
	fileName: string,
	contentType: string,
	stream: Readable
) => {
	const reply = res;
	reply.type(`${contentType};charset=utf-8`);
	reply.header('Content-Disposition', `attachment;filename="${fileName}"`);
	reply.header('Transfer-Encoding', 'chunked');

	// Pipe each row to the response
	reply.send(stream);

	// If an error occurs, close the stream
	stream.on('error', (err) => {
		req.log.error(`${contentType} export error occurred`, err);

		stream.destroy();

		// End the download
		reply.raw.end();
	});

	stream.on('end', () => {
		stream.destroy();
	});

	// If the client drops the connection, stop processing the stream
	req.raw.on('close', () => {
		if (!stream.destroyed) {
			req.log.info(
				`${contentType} export aborted because client dropped the connection`
			);
			stream.destroy();
		}

		// End the download.
		reply.raw.end();
	});
};

export async function loadExportConfigById(req: FastifyRequest) {
	const id = req.params['id'];
	req.exportConfig = await exportConfigService.read(id);

	if (!req.exportConfig) {
		throw new NotFoundError(
			'Export configuration not found. Document may have expired.'
		);
	}

	// Parse query from JSON string
	req.exportQuery = req.exportConfig.config.q
		? JSON.parse(req.exportConfig.config.q)
		: {};

	auditService
		.audit(
			`${req.exportConfig.type} export config retrieved`,
			'export',
			'export',
			req,
			req.exportConfig.auditCopy()
		)
		.then();
}
