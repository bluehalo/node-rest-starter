import { config } from '../../../dependencies';
import pkg from '../../../../package.json';

export const getSystemConfig = () => {
	const toReturn = {
		auth: config.auth.strategy,
		apiDocs: config.apiDocs,
		app: config.app,
		requiredRoles: config.auth.requiredRoles,

		version: pkg.version,
		banner: config.banner,
		copyright: config.copyright,

		contactEmail: config.app.contactEmail,

		maxExport: config.maxExport,
		feedback: config.feedback,
		teams: config.teams,

		userPreferences: config.userPreferences,

		masqueradeEnabled:
			config.auth.strategy === 'proxy-pki' && config.auth.masquerade === true,
		masqueradeUserHeader: config.masqueradeUserHeader,

		allowDelete: config.allowDelete
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
