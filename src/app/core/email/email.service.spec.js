'use strict';

const
	should = require('should'),
	emailService = require('./email.service');

/**
 * Globals
 */

/**
 * Unit tests
 */
describe('Email Service:', () => {

	describe('getMissingMailOptions:', () => {

		it('should find required missing fields', () => {
			let missing = emailService.getMissingMailOptions({});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: null});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: undefined});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: ''});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: null, from: '', html: null});
			missing.length.should.equal(4);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"from"');
			missing[2].should.equal('"subject"');
			missing[3].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: 'recipient', from: '', html: null});
			missing.length.should.equal(3);
			missing[0].should.equal('"from"');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: 'recipient'});
			missing.length.should.equal(3);
			missing[0].should.equal('"from"');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({from: 'sender'});
			missing.length.should.equal(3);
			missing[0].should.equal('("to" or "cc" or "bcc")');
			missing[1].should.equal('"subject"');
			missing[2].should.equal('("text" or "html")');

			missing = emailService.getMissingMailOptions({to: 'recipient', from: 'sender', html: '("text" or "html")'});
			missing.length.should.equal(1);
			missing[0].should.equal('"subject"');

			missing = emailService.getMissingMailOptions({to: 'recipient', from: 'sender', html: '("text" or "html")', subject: '"subject"'});
			missing.length.should.equal(0);
		});

	});

});
