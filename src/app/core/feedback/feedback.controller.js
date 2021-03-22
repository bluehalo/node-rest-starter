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
		const audit = await auditService.audit(
			'Feedback submitted',
			'feedback',
			'create',
			TeamMember.auditCopy(
				req.user,
				utilService.getHeaderField(req.headers, 'x-real-ip')
			),
			req.body,
			req.headers
		);
		const feedback = await feedbackService.create(
			req.user,
			req.body,
			audit.audit.userSpec
		);
		await feedbackService.sendFeedback(req.user, feedback, req);

		res.status(200).json(feedback);
	} catch (err) {
		logger.error(
			{ err: err, req: req },
			'Error submitting feedback'
		);
		utilService.handleErrorResponse(res, err);
	}
};

module.exports.adminGetFeedbackCSV = async function(req, res) {
	const exportId = req.params.exportId;

	const dateCallback = (value) =>
		value ? new Date(value).toISOString() : '';
	const defaultCallback = (value) => (value ? value : '');

	try {
		const result = await exportConfigService.getConfigById(exportId);

		if (null == result) {
			return Promise.reject({
				status: 404,
				type: 'bad-argument',
				message:
					'Export configuration not found. Document may have expired.'
			});
		}

		const exportFileName = `${config.app.instanceName}-${result.type}.csv`;

		await auditService.audit(
			`${result.type} CSV config retrieved`,
			'export',
			'export',
			TeamMember.auditCopy(
				req.user,
				utilService.getHeaderField(req.headers, 'x-real-ip')
			),
			ExportConfig.auditCopy(result),
			req.headers
		);

		const columns = result.config.cols;
		// Based on which columns are requested, handle property-specific behavior (ex. callbacks for the
		// CSV service to make booleans and dates more human-readable)
		columns.forEach((col) => {
			col.callback =
				col.key === 'created' || col.key === 'updated'
					? dateCallback
					: defaultCallback;
		});

		const query = result.config.q ? JSON.parse(result.config.q) : null;
		const sortArr = [
			{ property: result.config.sort, direction: result.config.dir }
		];

		const feedbackResult = await Feedback.textSearch(
			query,
			null,
			null,
			null,
			sortArr,
			true,
			{
				path: 'creator',
				select: ['username', 'organization', 'name', 'email']
			}
		);

		exportConfigController.exportCSV(
			req,
			res,
			exportFileName,
			columns,
			feedbackResult.results
		);
	} catch (err) {
		logger.error(
			{ err: err, req: req },
			'Error exporting feedback entries'
		);
		utilService.handleErrorResponse(res, err);
	}
};

module.exports.search = async (req, res) => {
	const filters = [];
	if (req.body.q) {
		filters.push(req.body.q);
	}

	const search = req.body.s || null;

	if (search) {
		filters.push({ $text: { $search: search } });
	}

	const query = filters.length > 0 ? { $and: filters } : undefined;

	try {
		const searchPromise = feedbackService.search(
			req.user,
			req.query,
			query
		);

		res.status(200).json(await searchPromise);
	} catch (err) {
		logger.error(
			{ err: err, req: req },
			'Error searching for feedback entries'
		);
		utilService.handleErrorResponse(res, err);
	}
};

module.exports.updateFeedbackAssignee = async (req, res) => {
	try {
		// Audit feedback assignee update
		await auditService.audit(
			'Feedback assignee updated',
			'feedback',
			'update',
			TeamMember.auditCopy(
				req.user,
				utilService.getHeaderField(req.headers, 'x-real-ip')
			),
			req.body,
			req.headers
		);

		const updateFeedbackAssigneePromise = feedbackService.updateFeedbackAssignee(
			req.params.feedbackId,
			req.body.assignee
		);

		res.status(200).json(
			await updateFeedbackAssigneePromise
		);
	} catch (err) {
		logger.error(
			{ err: err, req: req },
			'Error updating feedback assignee'
		);
		utilService.handleErrorResponse(res, err);
	}
};

module.exports.updateFeedbackStatus = async (req, res) => {
	try {
		// Audit feedback status update
		await auditService.audit(
			'Feedback status updated',
			'feedback',
			'update',
			TeamMember.auditCopy(
				req.user,
				utilService.getHeaderField(req.headers, 'x-real-ip')
			),
			req.body,
			req.headers
		);

		const updateFeedbackStatusPromise = feedbackService.updateFeedbackStatus(
			req.params.feedbackId,
			req.body.status
		);

		res.status(200).json(
			await updateFeedbackStatusPromise
		);
	} catch (err) {
		logger.error({ err: err, req: req }, 'Error updating feedback status');
		utilService.handleErrorResponse(res, err);
	}
};
