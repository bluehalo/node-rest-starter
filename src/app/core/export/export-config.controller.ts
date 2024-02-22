import os from 'os';
import { Readable, Transform } from 'stream';

import { StatusCodes } from 'http-status-codes';

import { ExportColumnDef } from './export-config.model';
import exportConfigService from './export-config.service';
import { auditService, csvStream, logger } from '../../../dependencies';
import { NotFoundError } from '../../common/errors';

/**
 * Request to generate an export configuration in preparation to serve a CSV download soon. The config document will
 * expire after a number of minutes (see export-config.server.service).
 */
export const requestExport = async (req, res) => {
	if (req.body.config.q) {
		// Stringify the query JSON because '$' is reserved in Mongo.
		req.body.config.q = JSON.stringify(req.body.config.q);
	}

	const generatedConfig = await exportConfigService.create(req.body);

	auditService.audit(
		`${req.body.type} config created`,
		'export',
		'create',
		req,
		generatedConfig.auditCopy()
	);

	res.status(StatusCodes.OK).json({ _id: generatedConfig._id });
};

/**
 * Export a CSV file with rows derived from an array of objects or a readable stream
 *
 * @param req
 * @param res
 * @param filename the name of the exported file
 * @param columns the columns to include in the exported CSV file
 * @param data an array of objects containing data for rows, or an instance of readable
 */
export const exportCSV = (
	req,
	res,
	filename: string,
	columns: ExportColumnDef[],
	data: Array<unknown> | Readable
) => {
	if (null !== data) {
		exportStream(
			req,
			res,
			filename,
			'text/csv',
			buildExportStream(
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
			)
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
const exportStream = (
	req,
	res,
	fileName: string,
	contentType: string,
	stream: Readable
) => {
	res.set('Content-Type', `${contentType};charset=utf-8`);
	res.set('Content-Disposition', `attachment;filename="${fileName}"`);
	res.set('Transfer-Encoding', 'chunked');

	// Pipe each row to the response
	stream.pipe(res);

	// If an error occurs, close the stream
	stream.on('error', (err) => {
		logger.error(err, `${contentType} export error occurred`);

		stream.destroy();

		// End the download
		res.end();
	});

	stream.on('end', () => {
		stream.destroy();
	});

	// If the client drops the connection, stop processing the stream
	req.on('close', () => {
		if (!stream.destroyed) {
			logger.info(
				`${contentType} export aborted because client dropped the connection`
			);

			stream.destroy();
		}

		// End the download.
		res.end();
	});
};

/**
 * export middleware
 */
const loadExportConfigById = async (req, res, id) => {
	const exportConfig = await exportConfigService.read(id);

	if (exportConfig == null) {
		throw new NotFoundError(
			'Export configuration not found. Document may have expired.'
		);
	}

	req.exportConfig = exportConfig;

	// Parse query from JSON string
	req.exportQuery = exportConfig.config.q
		? JSON.parse(exportConfig.config.q)
		: {};

	auditService.audit(
		`${exportConfig.type} CSV config retrieved`,
		'export',
		'export',
		req,
		exportConfig.auditCopy()
	);
};
export const exportConfigById = (req, res, next, id) =>
	loadExportConfigById(req, res, id).then(next).catch(next);
