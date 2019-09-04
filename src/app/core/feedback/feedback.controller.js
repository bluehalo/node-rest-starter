'use strict';

const
	deps = require('../../../dependencies'),
	dbs = deps.dbs,
	config = deps.config,
	logger = deps.logger,
	auditService = deps.auditService,
	emailService = deps.emailService,
	utilService = deps.utilService,

	exportConfigController = require('../export/export-config.controller'),
	exportConfigService = require('../export/export-config.service'),

	feedbackService = require('./feedback.service'),

	Feedback = dbs.admin.model('Feedback'),
	TeamMember = dbs.admin.model('TeamUser'),
	ExportConfig = dbs.admin.model('ExportConfig');


function buildEmailContent(user, feedback) {
	let emailData = {
		appName: config.app.name,
		name: user.name,
		username: user.username,
		email: user.email,
		url: feedback.url,
		feedback: feedback.body,
		feedbackType: feedback.type
	};

	return emailService.buildEmailContent('src/app/core/feedback/templates/user-feedback-email.view.html', emailData);
}

async function sendFeedback(user, feedback) {
	if (null == user || null == feedback.body || null == feedback.type || null == feedback.url) {
		return Promise.reject({ status: 400, message: 'Invalid submission.' });
	}

	return buildEmailContent(user, feedback).then((content) => {
		let mailOptions = {
			bcc: config.contactEmail,
			from: config.mailer.from,
			replyTo: config.mailer.from,
			subject: emailService.getSubject(`${config.app.title}: Feedback Submitted`),
			html: content
		};

		return emailService.sendMail(mailOptions);
	});
}

module.exports.submitFeedback = async function(req, res) {
	try {
		let audit = await auditService.audit('Feedback submitted', 'feedback', 'create', TeamMember.auditCopy(req.user, utilService.getHeaderField(req.headers, 'x-real-ip')), req.body, req.headers);
		let feedback = await feedbackService.create(req.user, req.body, audit.audit.userSpec);
		await sendFeedback(req.user, feedback);
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

		let result = await exportConfigService.getConfigById(exportId);

		if (null == result) {
			return Promise.reject({
				status: 404,
				type: 'bad-argument',
				message: 'Export configuration not found. Document may have expired.'
			});
		}

		let exportFileName = `${config.app.instanceName}-${result.type}.csv`;

		await auditService.audit(`${result.type} CSV config retrieved`, 'export', 'export', TeamMember.auditCopy(req.user, utilService.getHeaderField(req.headers, 'x-real-ip')), ExportConfig.auditCopy(result), req.headers);

		const query = (result.config.q) ? JSON.parse(result.config.q) : null;
		const sortArr = [{property: result.config.sort, direction: result.config.dir}];

		let feedbackResult = await Feedback.search(query, null, null, null, sortArr, true, {
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
