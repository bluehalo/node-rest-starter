'use strict';

const
	path = require('path'),
	q = require('q'),
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
	let emailConfig = config.mailer || {};

	if(null == provider && null != emailConfig.provider) {
		provider = require(path.posix.resolve(emailConfig.provider))(emailConfig.options);
	}

	return provider;
}

/**
 * Detects issues with mailOptions
 * returns an array of fields missing from mailOptions
 */
function getMissingMailOptions(mailOptions) {
	let requiredOptions = [
		['to', 'cc', 'bcc'],
		'from',
		'subject',
		['text', 'html']
	];

	let missingOptions = [];

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

module.exports.sendMail = (mailOptions) => {
	let defer = q.defer();

	// Make sure that the mailer is configured
	const mailProvider = getProvider();
	if (!mailProvider) {
		defer.reject({ message: 'Email service is not configured' });
		return defer.promise;
	}
	// Make sure mailOptions are specified
	if (!mailOptions) {
		defer.reject({ message: 'No email options specified' });
		return defer.promise;
	}

	// Make sure all the required mailOptions are defined
	let missingOptions = getMissingMailOptions(mailOptions);
	if (missingOptions.length > 0) {
		defer.reject({ message: `The following required values were not specified in mailOptions: ${missingOptions.join(', ')}`});
		return defer.promise;
	}

	mailProvider.sendMail(mailOptions)
		.then((results) =>{
			logger.debug(`Sent email to: ${mailOptions.to}`);
			defer.resolve(mailOptions);
		}).catch((error) => {
			defer.reject(error);
		});

	return defer.promise;
};

module.exports.buildEmailContent = (templatePath, data) => {
	let defer = q.defer();

	fs.readFile(templatePath, 'utf-8', (err, source) => {
		if (err) {
			defer.reject(err);
		} else {
			handlebars.registerPartial(templatePath, source);
			data.emailTemplate = () => templatePath;

			// Set email header/footer
			data.header = config.email.header;
			data.footer = config.email.footer;

			defer.resolve(handlebars.compile(source)(data));
		}
	});

	return defer.promise;
};

module.exports.getSubject = (subject) => {
	return (config.email.subjectPrefix ? config.email.subjectPrefix + ' ' : '') + subject;
};
