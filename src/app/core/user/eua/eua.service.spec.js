'use strict';

const mongoose = require('mongoose'),
	should = require('should'),
	euaService = require('./eua.service'),
	deps = require('../../../../dependencies'),
	User = deps.dbs.admin.model('User'),
	UserAgreement = deps.dbs.admin.model('UserAgreement');

/**
 * Unit tests
 */
describe('EUA Service:', () => {
	beforeEach(async () => {
		await Promise.all([
			User.deleteMany().exec(),
			UserAgreement.deleteMany().exec()
		]);
	});

	afterEach(async () => {
		await Promise.all([
			User.deleteMany().exec(),
			UserAgreement.deleteMany().exec()
		]);
	});

	describe('create', () => {
		it('creates eua', async () => {
			// Create eua
			const data = {
				title: 'Title',
				text: 'Text'
			};

			// Create eua and verify properties
			let eua = await euaService.create(data);
			should.exist(eua);
			eua.title.should.equal('Title');
			eua.text.should.equal('Text');
			should.exist(eua.created);
			should.exist(eua.updated);
			(eua.created === eua.updated).should.be.true(
				'expected eua.created} to be equal to eua.updated'
			);

			// Re-query created eua and verify properties
			eua = await UserAgreement.findById(eua._id);
			should.exist(eua);
			eua.title.should.equal('Title');
			eua.text.should.equal('Text');
			should.exist(eua.created);
			should.exist(eua.updated);
			(eua.created === eua.updated).should.be.true(
				'expected eua.created} to be equal to eua.updated'
			);
		});
	});

	describe('read', () => {
		it('read finds eua', async () => {
			// Create eua
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			// Read eua
			eua = await euaService.read(eua._id);
			should.exist(eua);
			eua.title.should.equal('Title');
			eua.text.should.equal('Text');
		});

		it('read returns null for invalid id', async () => {
			// Read eua
			const eua = await euaService.read(
				mongoose.Types.ObjectId('012345678912')
			);
			should.not.exist(eua);
		});
	});

	describe('update', () => {
		it('publish date is set on eua', async () => {
			// Create eua
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			// Update eua
			const update = { title: 'New Title', text: 'New Text' };
			eua = await euaService.update(eua, update);
			eua.title.should.equal('New Title');
			eua.text.should.equal('New Text');

			// re-query and verify update
			eua = await UserAgreement.findById(eua._id);
			should.exist(eua);
			eua.title.should.equal('New Title');
			eua.text.should.equal('New Text');
		});
	});

	describe('remove', () => {
		it('eua is removed', async () => {
			// Create eua
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			// Verify eua is in db
			eua = await UserAgreement.findById(eua._id);
			should.exist(eua);

			// Remove eua
			await euaService.remove(eua);

			// Verify eua is no longer in db
			eua = await UserAgreement.findById(eua._id);
			should.not.exist(eua);
		});
	});

	describe('search', () => {
		beforeEach(async () => {
			const euas = [...Array(100).keys()].map((index) => {
				return new UserAgreement({
					title: `Title-${index}`,
					text: `Text-${index}`
				});
			});

			await Promise.all(euas.map((eua) => eua.save()));
		});

		it('search results page returned', async () => {
			const queryParams = { size: 10 };
			const query = null;
			const search = '';
			const result = await euaService.search(queryParams, query, search);

			should.exist(result);
			result.totalSize.should.equal(100);
			result.pageSize.should.equal(queryParams.size);
			result.pageNumber.should.equal(0);
			result.totalPages.should.equal(100 / queryParams.size);
			result.elements.should.be.an.Array();
			result.elements.length.should.be.equal(queryParams.size);
		});
	});

	describe('publishEua', () => {
		it('publish date is set on eua', async () => {
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			should.not.exist(eua.published);

			eua = await euaService.publishEua(eua);

			should.exist(eua);
			should.exist(eua.published);
		});
	});

	describe('getCurrentEua', () => {
		it('No euas exist', async () => {
			const eua = await euaService.getCurrentEua();

			should.not.exist(eua);
		});

		it('euas exists, none are published', async () => {
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			eua = await euaService.getCurrentEua();

			should.not.exist(eua);
		});

		it('Current eua exists', async () => {
			const eua1 = new UserAgreement({
				title: 'Title1',
				text: 'Text1',
				published: Date.now()
			});
			const eua2 = new UserAgreement({
				title: 'Title2',
				text: 'Text2'
			});
			await Promise.all([eua1.save(), eua2.save()]);

			const eua = await euaService.getCurrentEua();

			should.exist(eua);
			eua.title.should.equal(eua1.title);
			eua.text.should.equal(eua1.text);
		});
	});

	describe('acceptEua', () => {
		it('Accept Eua; no previous eua accepted', async () => {
			const now = Date.now();

			// Create test user
			let user = new User({
				name: 'Name',
				email: 'user@mail.com',
				username: 'username',
				organization: 'Organization',
				provider: 'local',
				password: 'password'
			});
			await user.save();

			// Verify accepted eua date is not set
			should.not.exist(user.acceptedEua);

			// accept eua
			await euaService.acceptEua(user);

			// query for user and verify accepted eua is now set
			user = await User.findById(user._id);
			should.exist(user.acceptedEua);
			user.acceptedEua.should.be.greaterThan(now);
		});

		it('Accept Eua; previous eua accepted', async () => {
			const now = Date.now();

			// Create test user
			let user = new User({
				name: 'Name',
				email: 'user@mail.com',
				username: 'username',
				organization: 'Organization',
				provider: 'local',
				password: 'password',
				acceptedEua: now
			});
			await user.save();

			// Verify accepted eua date is set
			should.exist(user.acceptedEua);

			// accept eua
			await euaService.acceptEua(user);

			// query for user and verify accepted eua is now updated
			user = await User.findById(user._id);
			should.exist(user.acceptedEua);
			user.acceptedEua.should.be.greaterThan(now);
		});
	});
});
