const should = require('should');

describe('Config Server Controller', function() {

	let configController = require('./config.controller');

	describe('#getSystemConfig', function() {

		it('should not include the mailer configuration', function() {
			let systemConfig = configController.getSystemConfig();
			systemConfig.should.not.have.property('mailer');
		});

		it('should only include a contact email address', function() {
			let systemConfig = configController.getSystemConfig();
			systemConfig.should.have.property('contactEmail');
			systemConfig.contactEmail.should.be.a.String();
		});
	});
});
