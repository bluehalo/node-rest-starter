'use strict';

const
	deps = require('../../../../dependencies'),
	logger = deps.logger;

/**
 * Mocks sending an email with the input mail options by simply logging it
 * @param {object} mailOptions <p>Configuration for mail options with input values as:
 * <pre>{
 *   'to': '',
 *   'cc': '',
 *   'bcc': '',
 *   'from': '',
 *   'subject': '',
 *   'text': '',
 *   'html': ''
 * }</pre>
 * One of 'text' or 'html' is expected</p>
 */
const sendMail = (mailOptions) => {

	return new Promise((resolve, reject) => {
		logger.info('Requested email sent with:', mailOptions);
		resolve();
	});

};

// log-email provider requires configuration to be passed in, but it isn't used
module.exports = function(inputConfig) {
	return {
		sendMail
	};
};
