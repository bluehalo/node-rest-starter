import path from 'path';

import _ from 'lodash';

import { EmailProvider, MailOptions } from './providers/email.provider';
import { config } from '../../../dependencies';
import { logger } from '../../../lib/logger';
import templateService from '../../common/template.service';

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

	async generateMailOptions(
		user,
		emailTemplateConfig,
		emailContentData = {},
		emailSubjectData = {},
		mailOpts = {}
	): Promise<MailOptions> {
		if (user.toObject) {
			user = user.toObject();
		}
		let emailContent: string;
		let emailSubject: string;
		try {
			emailContent = await this.buildEmailContent(
				path.posix.resolve(emailTemplateConfig.templatePath),
				user,
				emailContentData
			);
			emailSubject = this.buildEmailSubject(
				emailTemplateConfig.subject,
				user,
				emailSubjectData
			);
		} catch (error) {
			logger.error('Failure rendering template.', { err: error });
			return Promise.reject(error);
		}

		return _.merge(
			{},
			config.get('coreEmails.default'),
			emailTemplateConfig,
			mailOpts,
			{
				subject: emailSubject,
				html: emailContent
			}
		);
	}

	buildEmailContent(
		templatePath: string,
		user,
		overrides = {}
	): Promise<string> {
		// Set email header/footer
		const data = _.merge(
			{},
			config.get('coreEmails.default'),
			{
				user: user
			},
			overrides
		);

		return templateService.renderTemplate(templatePath, data);
	}

	buildEmailSubject(template: string, user, overrides = {}): string {
		const data = _.merge(
			{},
			config.get('coreEmails.default'),
			{
				user: user
			},
			overrides
		);
		return templateService.renderTemplateStr(template, data);
	}

	/**
	 * Initializes the provider only once. Use the getProvider() method
	 * to create and/or retrieve this singleton
	 */
	async getProvider(): Promise<EmailProvider> {
		if (!this.provider && config.has('mailer.provider')) {
			const { default: Provider } = await import(
				path.posix.resolve(config.get('mailer.provider'))
			);
			this.provider = new Provider(config.get('mailer.options'));
		}
		return this.provider;
	}
}

export = new EmailService();
