import configService from './config.service';

import assert from 'node:assert/strict';

describe('Config Server Controller', () => {
	describe('#getSystemConfig', () => {
		it('should not include the mailer configuration', () => {
			const systemConfig = configService.getSystemConfig() as any;
			assert.equal(systemConfig.mailer, undefined);
		});

		it('should only include a contact email address', () => {
			const systemConfig = configService.getSystemConfig();
			assert(systemConfig.contactEmail);
			assert(typeof systemConfig.contactEmail, 'string');
		});

		it('should include apiDocs', () => {
			const systemConfig = configService.getSystemConfig();
			assert(systemConfig.apiDocs);
		});
	});
});
