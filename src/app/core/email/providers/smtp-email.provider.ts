import nodemailer from 'nodemailer';

import { EmailProvider, MailOptions } from './email.provider';

export default class SmtpEmailProvider implements EmailProvider {
	transport;

	constructor(config) {
		// initialize the smtp transport mailer
		this.transport = nodemailer.createTransport(config);
	}

	sendMail(mailOptions: MailOptions): Promise<void> {
		return this.transport.sendMail(mailOptions);
	}
}
