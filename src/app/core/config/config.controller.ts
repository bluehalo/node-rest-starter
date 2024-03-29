import { config } from '../../../dependencies';
import pkg from '../../../../package.json';

export const getSystemConfig = () => {
	const toReturn = {
		auth: config.get('auth.strategy'),
		apiDocs: config.get('apiDocs'),
		app: config.get('app'),
		requiredRoles: config.get('auth.requiredRoles'),

		version: pkg.version,
		banner: config.get('banner'),
		copyright: config.get('copyright'),

		contactEmail: config.get('app.contactEmail'),

		feedback: config.get('feedback'),
		teams: config.get('teams'),

		userPreferences: config.get('userPreferences'),

		masqueradeEnabled:
			config.get('auth.strategy') === 'proxy-pki' &&
			config.get('auth.masquerade') === true,
		masqueradeUserHeader: config.get('masqueradeUserHeader'),

		allowDeleteUser: config.get('allowDeleteUser')
	};

	return toReturn;
};

// Read
export const read = function (req, res) {
	/**
	 *  Add unsecured configuration data
	 */
	res.json(getSystemConfig());
};
