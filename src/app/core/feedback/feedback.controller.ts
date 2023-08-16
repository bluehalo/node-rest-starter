import feedbackService from './feedback.service';
import { auditService, config } from '../../../dependencies';
import * as exportConfigController from '../export/export-config.controller';
import exportConfigService from '../export/export-config.service';

export const submitFeedback = async function (req, res) {
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

export const adminGetFeedbackCSV = async function (req, res) {
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

	const feedbackCursor = feedbackService.cursorSearch(
		result.config,
		search,
		query,
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
		feedbackCursor
	);
};

export const search = async (req, res) => {
	const results = await feedbackService.search(
		req.query,
		req.body.s,
		req.body.q,
		{
			path: 'creator',
			select: ['username', 'organization', 'name', 'email']
		}
	);
	res.status(200).json(results);
};

export const updateFeedbackAssignee = async (req, res) => {
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

export const updateFeedbackStatus = async (req, res) => {
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
export const feedbackById = async (req, res, next, id) => {
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
