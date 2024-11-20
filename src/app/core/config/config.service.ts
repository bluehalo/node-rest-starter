import { config } from '../../../dependencies';
import pkg from '../../../../package.json';

class ConfigService {
	getSystemConfig() {
		return {
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
			help: config.get('help'),

			userPreferences: config.get('userPreferences'),

			masqueradeEnabled:
				config.get('auth.strategy') === 'proxy-pki' &&
				config.get('auth.masquerade') === true,
			masqueradeUserHeader: config.get('masqueradeUserHeader'),

			allowDeleteUser: config.get('allowDeleteUser')
		};
	}
}

export default new ConfigService();
