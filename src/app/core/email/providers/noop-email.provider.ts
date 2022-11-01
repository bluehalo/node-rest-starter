import { EmailProvider } from './email.provider';

export default class implements EmailProvider {
	/**
	 * Mocks sending an email with the input mail options by simply ignoring it.
	 */
	sendMail(): Promise<void> {
		return Promise.resolve();
	}
}
