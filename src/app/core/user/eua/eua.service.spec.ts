import assert from 'node:assert/strict';

import { FilterQuery } from 'mongoose';

import { UserAgreement, UserAgreementDocument } from './eua.model';
import euaService from './eua.service';
import { User } from '../user.model';

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
			assert(eua);
			assert.equal(eua.title, 'Title');
			assert.equal(eua.text, 'Text');
			assert(eua.created);
			assert(eua.updated);
			assert(
				eua.created === eua.updated,
				'expected eua.created to be equal to eua.updated on create'
			);

			// Re-query created eua and verify properties
			eua = await UserAgreement.findById(eua._id);
			assert(eua);
			assert.equal(eua.title, 'Title');
			assert.equal(eua.text, 'Text');
			assert(eua.created);
			assert(eua.updated);
			assert(
				eua.created.toString() === eua.updated.toString(),
				'expected eua.created to be equal to eua.updated on find'
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
			assert(eua);
			assert.equal(eua.title, 'Title');
			assert.equal(eua.text, 'Text');
		});

		it('read returns null for invalid id', async () => {
			// Read eua
			const eua = await euaService.read('123412341234123412341234');
			assert.equal(eua, null);
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
			assert(eua);
			assert.equal(eua.title, 'New Title');
			assert.equal(eua.text, 'New Text');

			// re-query and verify update
			eua = await UserAgreement.findById(eua._id);
			assert(eua);
			assert.equal(eua.title, 'New Title');
			assert.equal(eua.text, 'New Text');
		});
	});

	describe('delete', () => {
		it('eua is deleted', async () => {
			// Create eua
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			// Verify eua is in db
			eua = await UserAgreement.findById(eua._id);
			assert(eua);

			// Remove eua
			await euaService.delete(eua);

			// Verify eua is no longer in db
			eua = await UserAgreement.findById(eua._id);
			assert.equal(eua, null);
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
			const query: FilterQuery<UserAgreementDocument> = {};
			const search = '';
			const { elements, ...result } = await euaService.search(
				queryParams,
				search,
				query
			);

			assert.deepStrictEqual(result, {
				totalSize: 100,
				pageSize: queryParams.size,
				pageNumber: 0,
				totalPages: Math.ceil(100 / queryParams.size)
			});

			assert(Array.isArray(elements), 'elements should be an Array');
			assert.equal(elements.length, queryParams.size);
		});
	});

	describe('publishEua', () => {
		it('publish date is set on eua', async () => {
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			assert.equal(eua.published, null);

			eua = await euaService.publishEua(eua);

			assert(eua);
			assert(eua.published);
		});
	});

	describe('getCurrentEua', () => {
		it('No euas exist', async () => {
			const eua = await euaService.getCurrentEua();

			assert.equal(eua, null);
		});

		it('euas exists, none are published', async () => {
			let eua = new UserAgreement({
				title: 'Title',
				text: 'Text'
			});
			await eua.save();

			eua = await euaService.getCurrentEua();

			assert.equal(eua, null);
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

			assert(eua);
			assert.deepStrictEqual(eua.toObject(), eua1.toObject());
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
			assert.equal(user.acceptedEua, null);

			// accept eua
			await euaService.acceptEua(user);

			// query for user and verify accepted eua is now set
			user = await User.findById(user._id);
			assert(user.acceptedEua);
			assert(
				user.acceptedEua.getTime() >= now,
				'expected acceptedEua to be >= "now"'
			);
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
			assert(user.acceptedEua);

			// accept eua
			await euaService.acceptEua(user);

			// query for user and verify accepted eua is now updated
			user = await User.findById(user._id);
			assert(user.acceptedEua);
			assert(
				user.acceptedEua.getTime() >= now,
				'expected acceptedEua to be >= "now"'
			);
		});
	});
});
