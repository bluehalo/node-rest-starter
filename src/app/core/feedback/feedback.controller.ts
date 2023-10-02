import _ from 'lodash';
import { FilterQuery } from 'mongoose';

import { FeedbackDocument } from './feedback.model';
import feedbackService from './feedback.service';
import { auditService, config } from '../../../dependencies';
import { Callbacks } from '../export/callbacks';
import * as exportConfigController from '../export/export-config.controller';
import { IExportConfig } from '../export/export-config.model';

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

export const adminGetFeedbackCSV = function (req, res) {
	const exportConfig = req.exportConfig as IExportConfig;
	const exportQuery = req.exportQuery as FilterQuery<FeedbackDocument>;

	const fileName = `${config.app.instanceName}-${exportConfig.type}.csv`;

	const columns = exportConfig.config.cols;
	// Based on which columns are requested, handle property-specific behavior (ex. callbacks for the
	// CSV service to make booleans and dates more human-readable)
	columns.forEach((col) => {
		col.title = col.title ?? _.capitalize(col.key);

		switch (col.key) {
			case 'created':
			case 'updated':
				col.callback = Callbacks.isoDateString;
				break;
		}
	});

	const cursor = feedbackService.cursorSearch(
		exportConfig.config,
		exportConfig.config.s,
		exportQuery,
		{
			path: 'creator',
			select: ['username', 'organization', 'name', 'email']
		}
	);

	exportConfigController.exportCSV(req, res, fileName, columns, cursor);
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
