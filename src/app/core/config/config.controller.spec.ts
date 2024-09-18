import * as configController from './config.controller';

import assert from 'node:assert/strict';

describe('Config Server Controller', () => {
	describe('#getSystemConfig', () => {
		it('should not include the mailer configuration', () => {
			const systemConfig = configController.getSystemConfig() as any;
			assert.equal(systemConfig.mailer, undefined);
		});

		it('should only include a contact email address', () => {
			const systemConfig = configController.getSystemConfig();
			assert(systemConfig.contactEmail);
			assert(typeof systemConfig.contactEmail, 'string');
		});

		it('should include apiDocs', () => {
			const systemConfig = configController.getSystemConfig();
			assert(systemConfig.apiDocs);
		});
	});
});
