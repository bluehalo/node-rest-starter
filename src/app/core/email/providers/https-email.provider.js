'use strict';

const
	_ = require('lodash'),
	fs = require('fs'),
	https = require('https'),

	deps = require('../../../../dependencies'),
	logger = deps.logger;

let config = {};

const generateOptions = () => {
	/**
	 * @type {https.AgentOptions & { headers: Object<string, string|number>, method?: string, agent?: https.Agent }}
	 */
	const options = {
		host: config.hostname,
		port: config.port,
		ca: config.ca,
		cert: config.cert,
		key: config.key,
		passphrase: config.passphrase,
		headers: {
			Accept: 'application/json'
		}
	};

	options.agent = new https.Agent(options);

	return options;
};

/**
 * Converts the input mail options to a format expected by the HTTPS service
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
const transformMailOptions = (mailOptions) => {
	// Any transformations required for the mail options would go here
	return mailOptions;
};

/**
 * Sends an email with the input mail options by posting to a configured HTTPS endpoint
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
		const postData = JSON.stringify(transformMailOptions(mailOptions));
		const options = generateOptions();
		options.path = config.paths.within;
		options.method = 'POST';
		options.headers = options.headers || {};
		options.headers['Content-Type'] = 'application/json';
		options.headers['Content-Length'] = Buffer.byteLength(postData); // Buffer is globally defined by node.js

		let data = '';
		const req = https.request(options, (res) => {
			res.on('data', (chunk) => {
				data += chunk;
			});
			res.on('end', () => {
				if(res.statusCode === 404) {
					reject('Email service not found');
				}
				else if(res.statusCode !== 200) {
					reject(data); // send back the error
				}
				else {
					// 200 response
					const result = JSON.parse(data);
					resolve(result);
				}
			});
		});

		req.on('error', (err) => {
			reject(err);
		});

		req.write(postData);
		req.end();
	});

};

// https-email provider requires configuration to be passed in
module.exports = function(inputConfig) {

	config = inputConfig;

	logger.debug('Using HTTPS-based Email service');

	if(_.isString(config.ca)) { config.ca = fs.readFileSync(config.ca); }
	if(_.isString(config.cert)) { config.cert = fs.readFileSync(config.cert); }
	if(_.isString(config.key)) { config.key = fs.readFileSync(config.key); }

	return {
		sendMail
	};
};
