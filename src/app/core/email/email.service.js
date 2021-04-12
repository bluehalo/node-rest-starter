'use strict';

const path = require('path'),
	_ = require('lodash'),
	fs = require('fs'),
	handlebars = require('handlebars'),
	deps = require('../../../dependencies'),
	config = deps.config,
	logger = deps.logger;

let provider;

/**
 * Initializes the provider only once. Use the getProvider() method
 * to create and/or retrieve this singleton
 */
function getProvider() {
	const emailConfig = config.mailer || {};

	if (null == provider && null != emailConfig.provider) {
		provider = require(path.posix.resolve(emailConfig.provider))(
			emailConfig.options
		);
	}

	return provider;
}

/**
 * Detects issues with mailOptions
 * returns an array of fields missing from mailOptions
 */
function getMissingMailOptions(mailOptions) {
	const requiredOptions = [
		['to', 'cc', 'bcc'],
		'from',
		'subject',
		['text', 'html']
	];

	const missingOptions = [];

	requiredOptions.forEach((option) => {
		if (Array.isArray(option)) {
			if (!option.some((orField) => mailOptions[orField])) {
				missingOptions.push(`("${option.join('" or "')}")`);
			}
		} else if (!mailOptions[option]) {
			missingOptions.push(`"${option}"`);
		}
	});

	return missingOptions;
}

module.exports.getMissingMailOptions = getMissingMailOptions;

module.exports.sendMail = async (mailOptions) => {
	// Make sure that the mailer is configured
	const mailProvider = getProvider();
	if (!mailProvider) {
		return Promise.reject({ message: 'Email service is not configured' });
	}
	// Make sure mailOptions are specified
	if (!mailOptions) {
		return Promise.reject({ message: 'No email options specified' });
	}

	// Make sure all the required mailOptions are defined
	const missingOptions = getMissingMailOptions(mailOptions);
	if (missingOptions.length > 0) {
		return Promise.reject({
			message: `The following required values were not specified in mailOptions: ${missingOptions.join(
				', '
			)}`
		});
	}

	await mailProvider.sendMail(mailOptions);

	logger.debug(`Sent email to: ${mailOptions.to}`);
};

module.exports.buildEmailContent = async (
	templatePath,
	user,
	overrides = {}
) => {
	const templateString = await new Promise((resolve, reject) => {
		fs.readFile(templatePath, 'utf-8', (err, source) => {
			if (err) {
				reject(err);
			} else {
				resolve(source);
			}
		});
	});

	// Set email header/footer
	const data = _.merge(
		{},
		config.coreEmails.default,
		{
			app: config.app,
			user: user
		},
		overrides
	);

	return handlebars.compile(templateString)(data);
};

module.exports.buildEmailSubject = (template, user, overrides = {}) => {
	const data = _.merge(
		{},
		config.coreEmails.default,
		{
			app: config.app,
			user: user
		},
		overrides
	);
	return handlebars.compile(template)(data);
};

module.exports.generateMailOptions = async (
	user,
	req,
	emailConfig,
	emailContentData = {},
	emailSubjectData = {},
	mailOpts = {}
) => {
	if (user.toObject) {
		user = user.toObject();
	}
	let emailContent, emailSubject;
	try {
		emailContent = await module.exports.buildEmailContent(
			path.posix.resolve(emailConfig.templatePath),
			user,
			emailContentData
		);
		emailSubject = module.exports.buildEmailSubject(
			emailConfig.subject,
			user,
			emailSubjectData
		);
	} catch (error) {
		logger.error({ err: error, req: req }, 'Failure rendering template.');
		return Promise.reject(error);
	}

	return _.merge({}, config.coreEmails.default, emailConfig, mailOpts, {
		subject: emailSubject,
		html: emailContent
	});
};
