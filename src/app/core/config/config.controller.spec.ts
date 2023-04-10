import * as configController from './config.controller';

describe('Config Server Controller', () => {
	describe('#getSystemConfig', () => {
		it('should not include the mailer configuration', () => {
			const systemConfig = configController.getSystemConfig();
			systemConfig.should.not.have.property('mailer');
		});

		it('should only include a contact email address', () => {
			const systemConfig = configController.getSystemConfig();
			systemConfig.should.have.property('contactEmail');
			systemConfig.contactEmail.should.be.a.String();
		});

		it('should include apiDocs', () => {
			const systemConfig = configController.getSystemConfig();
			systemConfig.should.have.property('apiDocs');
			systemConfig.apiDocs.enabled.should.be.a.Boolean();
		});
	});
});
