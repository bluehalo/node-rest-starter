'use strict';

const {
		dbs,
		config,
		auditService,
		utilService
	} = require('../../../dependencies'),
	exportConfigController = require('../export/export-config.controller'),
	exportConfigService = require('../export/export-config.service'),
	feedbackService = require('./feedback.service'),
	Feedback = dbs.admin.model('Feedback');

module.exports.submitFeedback = async function (req, res) {
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

	res.status(200).json(feedback);
};

module.exports.adminGetFeedbackCSV = async function (req, res) {
	const exportId = req.params['exportId'];

	const dateCallback = (value) => (value ? new Date(value).toISOString() : '');
	const defaultCallback = (value) => (value ? value : '');

	const result = await exportConfigService.read(exportId);

	if (null == result) {
		return Promise.reject({
			status: 404,
			type: 'bad-argument',
			message: 'Export configuration not found. Document may have expired.'
		});
	}

	const exportFileName = `${config.app.instanceName}-${result.type}.csv`;

	await auditService.audit(
		`${result.type} CSV config retrieved`,
		'export',
		'export',
		req,
		result.auditCopy()
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
	const search = result.config.s;
	const sort = utilService.getSortObj(result.config);

	const feedbackCursor = Feedback.find(query)
		.textSearch(search)
		.sort(sort)
		.populate({
			path: 'creator',
			select: ['username', 'organization', 'name', 'email']
		})
		.cursor();

	exportConfigController.exportCSV(
		req,
		res,
		exportFileName,
		columns,
		feedbackCursor
	);
};

module.exports.search = async (req, res) => {
	const results = await feedbackService.search(
		req.query,
		req.body.s,
		req.body.q
	);
	res.status(200).json(results);
};

module.exports.updateFeedbackAssignee = async (req, res) => {
	// Audit feedback assignee update
	await auditService.audit(
		'Feedback assignee updated',
		'feedback',
		'update',
		req,
		req.body
	);

	const updateFeedbackAssigneePromise = feedbackService.updateFeedbackAssignee(
		req.feedback,
		req.body.assignee
	);
	const updatedFeedback = await updateFeedbackAssigneePromise;
	res.status(200).json(updatedFeedback);
};

module.exports.updateFeedbackStatus = async (req, res) => {
	// Audit feedback status update
	await auditService.audit(
		'Feedback status updated',
		'feedback',
		'update',
		req,
		req.body
	);

	const updateFeedbackStatusPromise = feedbackService.updateFeedbackStatus(
		req.feedback,
		req.body.status
	);
	const updatedFeedback = await updateFeedbackStatusPromise;
	res.status(200).json(updatedFeedback);
};

/**
 * Feedback middleware
 */
module.exports.feedbackById = async (req, res, next, id) => {
	const populate = [
		{
			path: 'creator',
			select: ['username', 'organization', 'name', 'email']
		}
	];

	req.feedback = await feedbackService.read(id, populate);
	if (!req.feedback) {
		throw {
			status: 404,
			type: 'not-found',
			message: 'Could not find feedback'
		};
	}
	return next();
};
