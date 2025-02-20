import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import { DateTime } from 'luxon';

import { EmailProvider, MailOptions } from './email.provider';
import { config } from '../../../../dependencies';
import { logger } from '../../../../lib/logger';

export default class implements EmailProvider {
	getFileName(mailOptions: MailOptions) {
		return `${path
			.basename(mailOptions.templatePath ?? 'email', '.html')
			.replace('.server', '')
			.replace('.view', '')}-${DateTime.now().toFormat('y-MM-dd-HH-mm-ss')}`;
	}

	/**
	 * Mocks sending an email with the input mail options by logging each email to individual files
	 */
	async sendMail(mailOptions: MailOptions): Promise<void> {
		const fileDirectory = config.get<string>('mailer.options.outputDir');

		// ensure directory exists
		await fsPromises.mkdir(fileDirectory, { recursive: true });

		const filename = `${fileDirectory}/${this.getFileName(mailOptions)}`;
		const content = `<p>To: ${mailOptions.to ?? ''}</p><br>
<p>cc: ${mailOptions.cc ?? ''}</p><br>
<p>bcc: ${mailOptions.bcc ?? ''}</p><br>
<p>From: ${mailOptions.from ?? ''}</p><br>
<p>Subject: ${mailOptions.subject ?? ''}</p><br>
<p>Text:</p><br>
<p>${mailOptions.text ?? mailOptions.html ?? ''}</p><br>
`;

		await fsPromises.writeFile(filename, content);
		logger.info('Logged email to file:', filename);
	}
}
