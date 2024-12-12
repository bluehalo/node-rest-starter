import nodemailer from 'nodemailer';

import { EmailProvider, MailOptions } from './email.provider';

export default class SmtpEmailProvider implements EmailProvider {
	transport;

	constructor(config: unknown) {
		// initialize the smtp transport mailer
		this.transport = nodemailer.createTransport(config);
	}

	async sendMail(mailOptions: MailOptions): Promise<void> {
		await this.transport.sendMail(mailOptions);
	}
}
