'use strict';

const express = require('express');
// Patches express to support async/await.  Should be called immediately after express.
require('express-async-errors');

const mock = require('mock-require'),
	request = require('supertest'),
	should = require('should'),
	{
		dbs: { admin }
	} = require('../../../../dependencies'),
	User = admin.model('User'),
	UserAgreement = admin.model('UserAgreement'),
	{ isISOString } = require('../../../../spec/helpers');

const matchesAnyString = (val) => {
	return typeof val === 'string';
};

const matchesAnyNumber = (val) => {
	return typeof val === 'number';
};

/**
 * Integration tests for the Express Routes and Mongoose Models
 */
describe('EUA Routes:', () => {
	const fakeUser = new User({
		username: 'test-user',
		email: 'test@user.com',
		roles: { admin: true, user: true }
	});

	let app;

	let savedEua;

	const router = express.Router();

	let userCtrl;
	let originalHasAccess;
	let originalHasAdmin;
	let originalRequiresLogin;

	before(() => {
		app = express();
		app.use(express.json());

		userCtrl = mock.reRequire('../user.controller');

		originalHasAccess = userCtrl.hasAccess;
		originalHasAdmin = userCtrl.hasAdminAccess;
		originalRequiresLogin = userCtrl.requiresLogin;
		userCtrl.hasAccess = (req, res, next) => {
			req.user = fakeUser;
			return next(); // pass-through
		};
		userCtrl.requiresLogin = (req, res, next) => {
			req.user = fakeUser;
			return Promise.resolve();
		};
		userCtrl.hasAdminAccess = (req, res, next) => {
			req.user = fakeUser;
			if (fakeUser.roles && fakeUser.roles.admin) {
				return next();
			} else {
				res.status(403).json({
					message: 'This is a fake error message'
				});
			}
		};

		router.use(mock.reRequire('./eua.routes'));
		app.use(router);
		app.use(
			require('../../../common/express/error-handlers').defaultErrorHandler
		);
	});

	beforeEach(async () => {
		savedEua = await new UserAgreement({
			title: 'test title',
			text: 'some text'
		}).save();
	});

	afterEach(async () => {
		await UserAgreement.deleteMany({}).exec();
	});

	after(() => {
		userCtrl.hasAccess = originalHasAccess;
		userCtrl.hasAdminAccess = originalHasAdmin;
		userCtrl.requiresLogin = originalRequiresLogin;
	});

	const publishSavedEua = async () => {
		await request(app)
			.post(`/eua/${savedEua._id.toString()}/publish`)
			.send({})
			.expect(200)
			.expect((res) => {
				should(res.body).match({
					__v: matchesAnyNumber,
					_id: matchesAnyString,
					id: matchesAnyString,
					published: isISOString,
					updated: isISOString,
					created: isISOString,
					title: 'test title',
					text: 'some text'
				});
			});
	};

	describe('searchEuas', () => {
		it('search returns euas', async () => {
			await request(app)
				.post('/euas?page=0&size=10')
				.send({})
				.expect(200)
				.expect((res) => {
					should(res.body).match({
						pageNumber: 0,
						pageSize: 10,
						totalPages: 1,
						totalSize: 1,
						elements: [
							{
								__v: matchesAnyNumber,
								_id: matchesAnyString,
								id: matchesAnyString,
								published: null,
								updated: isISOString,
								created: isISOString,
								title: 'test title',
								text: 'some text'
							}
						]
					});
				});
		});
	});

	describe('publishEua', () => {
		it('should publish the EUA', async () => {
			await publishSavedEua();
		});
	});

	describe('createEua', () => {
		it('should create the EUA', async () => {
			await request(app)
				.post('/eua')
				.send({
					title: 'EUA Title',
					text: 'This is EUA text.'
				})
				.expect(200)
				.expect((res) => {
					should(res.body).match({
						__v: matchesAnyNumber,
						_id: matchesAnyString,
						id: matchesAnyString,
						published: null,
						updated: isISOString,
						created: isISOString,
						title: 'EUA Title',
						text: 'This is EUA text.'
					});
				});
		});
	});

	describe('getCurrentEua', () => {
		it('should get the current EUA', async () => {
			await request(app)
				.get('/eua')
				.expect(200)
				.expect((res) => {
					// should not get the current EUA when none is published
					should(res.body).match(null);
				});

			await publishSavedEua();

			await request(app)
				.get('/eua')
				.expect(200)
				.expect((res) => {
					// should get the current eua after it is published
					should(res.body).match({
						title: 'test title',
						text: 'some text'
					});
				});
		});
	});

	describe('updateEua', () => {
		it('should update the EUA', async () => {
			await request(app)
				.post(`/eua/${savedEua._id.toString()}`)
				.send({
					title: 'EUA Title',
					text: 'Updated text'
				})
				.expect(200)
				.expect((res) => {
					should(res.body).match({
						title: 'EUA Title',
						text: 'Updated text'
					});
				});
		});
	});

	describe('deleteEua', () => {
		it('should delete the EUA', async () => {
			await request(app)
				.delete(`/eua/${savedEua._id.toString()}`)
				.send({
					title: 'EUA Title',
					text: 'Updated text'
				})
				.expect(200)
				.expect((res) => {
					should(res.body).match({});
				});
		});
	});
});
