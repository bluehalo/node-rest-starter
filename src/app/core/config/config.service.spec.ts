import assert from 'node:assert/strict';

import configService from './config.service';

describe('Config Server Controller', () => {
	describe('#getSystemConfig', () => {
		it('should not include the mailer configuration', () => {
			const systemConfig = configService.getSystemConfig() as Record<
				string,
				unknown
			>;
			assert.equal(systemConfig.mailer, undefined);
		});

		it('should only include a contact email address', () => {
			const systemConfig = configService.getSystemConfig();
			assert.ok(systemConfig.contactEmail);
			assert.ok(typeof systemConfig.contactEmail, 'string');
		});

		it('should include apiDocs', () => {
			const systemConfig = configService.getSystemConfig();
			assert.ok(systemConfig.apiDocs);
		});
	});
});
