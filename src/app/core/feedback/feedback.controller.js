'use strict';

const
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	logger = deps.logger,
	auditService = deps.auditService,
	utilService = deps.utilService,

	exportConfigController = require('../export/export-config.controller'),
	exportConfigService = require('../export/export-config.service'),

	feedbackService = require('./feedback.service'),

	Feedback = dbs.admin.model('Feedback'),
	TeamMember = dbs.admin.model('TeamUser'),
	ExportConfig = dbs.admin.model('ExportConfig');

module.exports.submitFeedback = async function(req, res) {
	try {
		const audit = await auditService.audit('Feedback submitted', 'feedback', 'create', TeamMember.auditCopy(req.user, utilService.getHeaderField(req.headers, 'x-real-ip')), req.body, req.headers);
		const feedback = await feedbackService.create(req.user, req.body, audit.audit.userSpec);
		await feedbackService.sendFeedback(req.user, feedback, req);
		res.status(200).json(feedback);
	} catch (err) {
		utilService.handleErrorResponse(res, err);
	}
};

module.exports.adminGetFeedbackCSV = async function(req, res) {
	const exportId = req.params.exportId;

	const dateCallback = (value) => (value) ? new Date(value).toISOString(): '';
	const defaultCallback = (value) => (value) ? value : '';

	const exportColumns = [
		{ key: 'url', title: 'Submitted From URL', callback: defaultCallback },
		{ key: 'body', title: 'Feedback Body', callback: defaultCallback },
		{ key: 'type', title: 'Feedback Type', callback: defaultCallback },
		{ key: 'creator.name', title: 'Submitted By Name', callback: defaultCallback },
		{ key: 'creator.username', title: 'Submitted By Username', callback: defaultCallback },
		{ key: 'creator.email', title: 'Submitted By Email', callback: defaultCallback },
		{ key: 'creator.organization', title: 'Submitted By Organization', callback: defaultCallback },
		{ key: 'created', title: 'Submit Date', callback: dateCallback }
	];

	try {

		const result = await exportConfigService.getConfigById(exportId);

		if (null == result) {
			return Promise.reject({
				status: 404,
				type: 'bad-argument',
				message: 'Export configuration not found. Document may have expired.'
			});
		}

		const exportFileName = `${config.app.instanceName}-${result.type}.csv`;

		await auditService.audit(`${result.type} CSV config retrieved`, 'export', 'export', TeamMember.auditCopy(req.user, utilService.getHeaderField(req.headers, 'x-real-ip')), ExportConfig.auditCopy(result), req.headers);

		const query = (result.config.q) ? JSON.parse(result.config.q) : null;
		const sortArr = [{property: result.config.sort, direction: result.config.dir}];

		const feedbackResult = await Feedback.search(query, null, null, null, sortArr, true, {
			path: 'creator',
			select: ['username', 'organization', 'name', 'email']
		});

		exportConfigController.exportCSV(req, res, exportFileName, exportColumns, feedbackResult.results);
	} catch (err) {
		logger.error({err: err, req: req}, 'Error exporting feedback entries');
		utilService.handleErrorResponse(res, err);
	}
};

module.exports.search = async (req, res) => {
	let query = req.body.q || {};
	query = { '$and': [ query ] };

	const search = req.body.s || null;

	if (search) {
		query.$and.push({ $text: { $search: search }});
		// query.$and.push({ name: new RegExp(search, 'i') });
	}

	try {
		res.status(200).json(await feedbackService.search(req.user, req.query, query));
	} catch (err) {
		logger.error({err: err, req: req}, 'Error searching for feedback entries');
		utilService.handleErrorResponse(res, err);
	}
};
