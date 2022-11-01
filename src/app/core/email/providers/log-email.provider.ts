import { logger } from '../../../../dependencies';
import { EmailProvider, MailOptions } from './email.provider';

export default class implements EmailProvider {
	/**
	 * Mocks sending an email with the input mail options by simply logging it
	 */
	sendMail(mailOptions: MailOptions): Promise<void> {
		return new Promise((resolve) => {
			logger.info('Requested email sent with:', mailOptions);
			resolve();
		});
	}
}
