import fs from 'fs';
import path from 'path';

import handlebars from 'handlebars';
import _ from 'lodash';

import { config, logger } from '../../../dependencies';
import { EmailProvider, MailOptions } from './providers/email.provider';

handlebars.registerHelper('toLowerCase', (str) => str.toLowerCase());

class EmailService {
	provider: EmailProvider;

	/**
	 * Detects issues with mailOptions
	 */
	validateMailOptions(mailOptions: MailOptions) {
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

		if (missingOptions.length > 0) {
			throw new Error(
				`The following required values were not specified in mailOptions: ${missingOptions.join(
					', '
				)}`
			);
		}
	}

	async sendMail(mailOptions?: MailOptions) {
		// Make sure that the mailer is configured
		const mailProvider = await this.getProvider();
		if (!mailProvider) {
			throw new Error('Email service is not configured');
		}
		// Make sure mailOptions are specified
		if (!mailOptions) {
			throw new Error('No email options specified');
		}

		// Make sure all the required mailOptions are defined
		this.validateMailOptions(mailOptions);

		await mailProvider.sendMail(mailOptions);

		logger.debug(`Sent email to: ${mailOptions.to}`);
	}

	async buildEmailContent(templatePath, user, overrides = {}) {
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
	}

	buildEmailSubject(template, user, overrides = {}): string {
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
	}

	async generateMailOptions(
		user,
		req,
		emailConfig,
		emailContentData = {},
		emailSubjectData = {},
		mailOpts = {}
	): Promise<MailOptions> {
		if (user.toObject) {
			user = user.toObject();
		}
		let emailContent, emailSubject;
		try {
			emailContent = await this.buildEmailContent(
				path.posix.resolve(emailConfig.templatePath),
				user,
				emailContentData
			);
			emailSubject = this.buildEmailSubject(
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
	}

	/**
	 * Initializes the provider only once. Use the getProvider() method
	 * to create and/or retrieve this singleton
	 */
	async getProvider(): Promise<EmailProvider> {
		if (!this.provider && config.mailer?.provider) {
			const { default: Provider } = await import(
				path.posix.resolve(config.mailer.provider)
			);
			this.provider = new Provider(config.mailer.options);
		}
		return this.provider;
	}
}

export = new EmailService();
