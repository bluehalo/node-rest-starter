const should = require('should');

describe('Config Server Controller', () => {

	const configController = require('./config.controller');

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
	});
});
