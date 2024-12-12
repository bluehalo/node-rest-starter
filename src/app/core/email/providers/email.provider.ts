export interface MailOptions {
	to?: string;
	from?: string;
	cc?: string;
	bcc?: string;
	replyTo?: string;
	subject?: string;
	text?: string;
	html?: string;
	templatePath?: string;
	header?: string;
	footer?: string;
}

export interface EmailProvider {
	sendMail: (mailOptions: MailOptions) => Promise<void>;
}
