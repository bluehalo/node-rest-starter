'use strict';

const
	os = require('os'),
	q = require('q'),
	stream = require('stream'),

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
					return q(generatedConfig);
				});
		}).then(
			(result) => {
				res.status(200).json({ _id: result._id});
			},
			(err) => {
				utilService.handleErrorResponse(res, err);
			})
		.done();
};

exports.exportCSV = (req, res, filename, columns, data) => {
	if (null !== data) {
		// Set up streaming res
		res.set('Content-Type', 'text/csv;charset=utf-8');
		res.set('Content-Disposition', `attachment;filename="${filename}"`);
		res.set('Transfer-Encoding', 'chunked');

		// Put into stream the data object
		const s = new stream.Readable({objectMode:true});
		s._read = () => {
			data.forEach((row) => {
				s.push(row);
			});
			s.push(null);
		};

		const sc = s.pipe(csvStream(columns));

		// Pipe each row to the response
		sc.pipe(res);

		// If an error occurs, close the stream
		s.on('error', (err) => {
			logger.error(err, 'CSV export error occurred');

			// End the download
			res.end();
		});

		// If the client drops the connection, stop processing the stream
		req.on('close', () => {
			logger.info('CSV export aborted because client dropped the connection');
			if (s != null) {
				s.destroy();
			}
			// End the download.
			res.end();
		});
	}
};

exports.exportPlaintext = (req, res, filename, text) => {

	if (null !== text) {
		// Set up streaming res
		res.set('Content-Type', 'text/plain;charset=utf-8');
		res.set('Content-Disposition', `attachment;filename="${filename}"`);
		res.set('Transfer-Encoding', 'chunked');

		// Put into stream the data object
		const s = new stream.Readable({objectMode:true});
		s._read = () => {
			text.split(os.EOL).forEach((row) => {
				s.push(row);
			});
			s.push(null);
		};

		// Pipe each row to the response
		s.pipe(res);

		// If an error occurs, close the stream
		s.on('error', (err) => {
			logger.error(err, 'Plaintext export error occurred');

			// End the download
			res.end();
		});

		// If the client drops the connection, stop processing the stream
		req.on('close', () => {
			logger.info('Plaintext export aborted because client dropped the connection');
			if (s != null) {
				s.destroy();
			}
			// End the download.
			res.end();
		});
	}
};
