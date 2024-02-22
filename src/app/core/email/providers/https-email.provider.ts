import fs from 'fs';
import https, { AgentOptions } from 'https';

import _ from 'lodash';

import { EmailProvider, MailOptions } from './email.provider';
import { logger } from '../../../../dependencies';
import { InternalServerError } from '../../../common/errors';

type Options = AgentOptions & {
	headers: Record<string, string | number>;
	method?: string;
	agent?: https.Agent;
};

export default class HttpsEmailProvider implements EmailProvider {
	options: Options;

	constructor(private config) {
		logger.debug('Using HTTPS-based Email service');

		if (_.isString(config.ca)) {
			config.ca = fs.readFileSync(config.ca);
		}
		if (_.isString(config.cert)) {
			config.cert = fs.readFileSync(config.cert);
		}
		if (_.isString(config.key)) {
			config.key = fs.readFileSync(config.key);
		}
	}

	/**
	 * Sends an email with the input mail options by posting to a configured HTTPS endpoint
	 */
	sendMail(mailOptions: MailOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			const postData = this.transformMailOptions(mailOptions);
			const options = this.getHttpsOptions();
			options.path = this.config.paths.within;
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
					if (res.statusCode === 404) {
						reject(new InternalServerError('Email service not found'));
					} else if (res.statusCode !== 200) {
						reject(data); // send back the error
					} else {
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
	}

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
	transformMailOptions = (mailOptions: MailOptions): string => {
		// Any transformations required for the mail options would go here
		return JSON.stringify(mailOptions);
	};

	getHttpsOptions() {
		if (!this.options) {
			this.options = {
				host: this.config.hostname,
				port: this.config.port,
				ca: this.config.ca,
				cert: this.config.cert,
				key: this.config.key,
				passphrase: this.config.passphrase,
				headers: {
					Accept: 'application/json'
				}
			};

			if (_.isString(this.options.ca)) {
				this.options.ca = fs.readFileSync(this.config.ca);
			}
			if (_.isString(this.options.cert)) {
				this.options.cert = fs.readFileSync(this.config.cert);
			}
			if (_.isString(this.options.key)) {
				this.options.key = fs.readFileSync(this.config.key);
			}

			this.options.agent = new https.Agent(this.options);
		}

		return this.options;
	}
}
