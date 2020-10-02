'use strict';

const
	os = require('os'),
	streams = require('stream'),
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	utilService = deps.utilService,
	logger = deps.logger,
	auditService = deps.auditService,
	csvStream = deps.csvStream,

	exportConfigService = require('./export-config.service'),
	TeamMember = dbs.admin.model('TeamUser'),
	ExportConfig = dbs.admin.model('ExportConfig');

/**
 * Request to generate an export configuration in preparation to serve a CSV download soon. The config document will
 * expire after a number of minutes (see export-config.server.service).
 */

exports.requestExport = (req, res) => {
	if (null != req.body.config.q) {
		// Stringify the query JSON because '$' is reserved in Mongo.
		req.body.config.q = JSON.stringify(req.body.config.q);
	}
	if (null == req.body.type) {
		return utilService.handleErrorResponse(res, { status: 400, type: 'missing export type', message: 'Missing export type.'});
	}

	exportConfigService.generateConfig(req)
	.then((generatedConfig) => {
			return auditService.audit(`${req.body.type} config created`, 'export', 'create', TeamMember.auditCopy(req.user, utilService.getHeaderField(req.headers, 'x-real-ip')), ExportConfig.auditCopy(generatedConfig), req.headers)
				.then(() => {
					return Promise.resolve(generatedConfig);
				});
		}).then(
			(result) => {
				res.status(200).json({ _id: result._id});
			},
			(err) => {
				utilService.handleErrorResponse(res, err);
			});
};


/**
 * Export a CSV file with rows derived from an array of objects or a readable stream
 *
 * @param {*} req
 * @param {*} res
 * @param {string} filename the name of the exported file
 * @param {{ key: string, title: string, callback?: Function }[]} columns the columns to include in the exported CSV file
 * @param {[] | streams.Readable} data an array of objects containing data for rows, or an instance of readable
 */
exports.exportCSV = (req, res, filename, columns, data) => {
	if (null !== data) {
		exportStream(
			req,
			res,
			filename,
			'csv',
			buildExportStream(
				data,
				(stream) => () => {
					data.forEach((row) => {
						stream.push(row);
					});
					stream.push(null);
				},
				[csvStream(columns)]
			)
		);
	}
};

/**
 * Export a plain text file with content derived from a string or a readable stream
 * @param {*} req
 * @param {*} res
 * @param {string} filename the name of the exported file
 * @param {streams.Readable | string} text the text or readable stream to export
 */
exports.exportPlaintext = (req, res, filename, text) => {
	if (null !== text) {
		exportStream(
			req,
			res,
			filename,
			'plain',
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
 * @param {streams.Readable | *} data the data to be exported, either in the form of a readable stream or an object accompanied by a getRead function
 * @param {Function} getRead a function that takes a readable stream and returns the _read function for the new stream if data is not a readable stream
 * @param {streams.Transform[]} [transforms] an optional array of transform streams through which to pipe the export data
 */
const buildExportStream = (data, getRead, transforms) => {
	let stream = data;

	if (!(stream instanceof streams.Readable)) {
		stream = new streams.Readable({ objectMode: true });
		stream._read = getRead(stream);
	}

	if (!stream.destroy) {
		stream.destroy = () => {
			stream.destroyed = true;
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
						originalDestroy.apply(this);
					} else {
						// the new stream did not have a defined `destroy()` function,
						//  so we should mark it as `destroyed` at this point
						newStream.destroyed = true;
					}

					// now destroy the previous stream
					prevStream.destroy();
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
 * @param {*} req
 * @param {*} res
 * @param {string} fileName
 * @param {'csv' | 'plain'} fileType
 * @param {streams.Readable} stream
 */
const exportStream = (req, res, fileName, fileType, stream) => {
	res.set('Content-Type', `text/${fileType};charset=utf-8`);
	res.set('Content-Disposition', `attachment;filename="${fileName}"`);
	res.set('Transfer-Encoding', 'chunked');

	// Pipe each row to the response
	stream.pipe(res);

	// If an error occurs, close the stream
	stream.on('error', (err) => {
		logger.error(
			err,
			`${fileType === 'csv' ? 'CSV' : 'PlainText'} export error occurred`
		);

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
				`${
					fileType === 'csv' ? 'CSV' : 'PlainText'
				} export aborted because client dropped the connection`
			);

			stream.destroy();
		}

		// End the download.
		res.end();
	});
};

