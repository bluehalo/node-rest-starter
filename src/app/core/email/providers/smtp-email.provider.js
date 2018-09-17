'use strict';

const nodemailer = require('nodemailer');

let smtpTransport;

const sendMail = (mailOptions) => {
	return new Promise((resolve, reject) => {
		smtpTransport.sendMail(mailOptions, (error) => {
			if (!error) {
				resolve(mailOptions);
			}
			else {
				reject(error);
			}
		});
	});
};

// smtp-email provider requires configuration to be passed in
module.exports = function(config) {
	// initialize the smtp transport mailer
	smtpTransport = nodemailer.createTransport(config);

	/**
	 * Public API for the smtp-email provider
	 */
	return {
		sendMail
	};
};
