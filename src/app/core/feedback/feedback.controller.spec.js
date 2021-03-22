'use strict';

const request = require('supertest'),
	should = require('should'),
	express = require('express'),
	bodyParser = require('body-parser'),
	mock = require('mock-require'),
	deps = require('../../../dependencies'),
	Feedback = deps.dbs.admin.model('Feedback'),
	User = deps.dbs.admin.model('User');

describe('Feedback Controller', () => {
	let app;
	const router = express.Router();

	const fakeUser = new User({
		username: 'some-user'
	});

	const clearDB = () => Feedback.deleteMany({}).exec();

	before(clearDB);
	after(clearDB);

	before(() => {
		app = express();
		app.use(bodyParser.json());

		// Mock access for the User Controller method that adds authentication to these endpoints
		mock('../user/user.controller', {
			has: () => {
				return (req, res, next) => {
					req.user = fakeUser;
					next();
				};
			},
			hasAccess: (req, res, next) => {
				req.user = fakeUser;
				next(); // pass-through
			},
			hasAdminAccess: (req, res, next) => {
				if (fakeUser.roles.admin) {
					return next();
				}
				res.status(403).json({
					message: 'This is a fake error message'
				});
			}
		});

		router.use(mock.reRequire('./feedback.routes'));
		app.use(router);
	});

	after(() => {
		// Stop mocking the User Controller
		mock.stopAll();
	});

	const setAdmin = (isAdmin) => {
		if (isAdmin) {
			fakeUser.roles = { user: true, admin: true };
		} else {
			fakeUser.roles = { user: true };
		}
	};

	describe('POST /feedback', () => {
		[
			{ name: 'non-admin', isAdmin: false },
			{ name: 'admin', isAdmin: true }
		].forEach((testConfig) => {
			it(`should submit feedback successfully as ${testConfig.name}`, (done) => {
				setAdmin(testConfig.isAdmin);

				const spec = {
					body: 'This is a test',
					type: 'Bug',
					url: 'http://localhost:3000/some-page?with=param'
				};

				request(app)
					.post('/feedback')
					.send(spec)
					.expect('Content-Type', /json/)
					.expect(200)
					.expect((res) => {
						Object.keys(spec).forEach((key) => {
							should(res.body[key]).eql(spec[key]);
						});
					})
					.end(done);
			});
		});

		it('should get an error submitting invalid feedback', (done) => {
			const spec = {
				// missing body
				type: 'Bug',
				url: 'http://localhost:3000/some-page?with=param'
			};

			request(app)
				.post('/feedback')
				.send(spec)
				.expect('Content-Type', /json/)
				.expect(400)
				.expect((res) => {
					should(res.body).eql({
						status: 400,
						message: 'Invalid submission.'
					});
				})
				.end(done);
		});
	});

	describe('POST /admin/feedback', () => {
		let savedFeedback;

		before(async () => {
			await Feedback.deleteMany({}).exec();
			savedFeedback = await new Feedback({
				body: 'testing',
				url: 'http://localhost:3000/home',
				type: 'Question'
			}).save();
		});

		[
			{ name: 'should not get feedback as non-admin', isAdmin: false },
			{ name: 'should get feedback as admin', isAdmin: true }
		].forEach((testConfig) => {
			it(testConfig.name, (done) => {
				setAdmin(testConfig.isAdmin);

				request(app)
					.post('/admin/feedback')
					.send({})
					.expect('Content-Type', /json/)
					.expect(testConfig.isAdmin ? 200 : 403)
					.expect((res) => {
						if (testConfig.isAdmin) {
							const expected = savedFeedback.toJSON();
							expected._id = expected._id.toString();

							should(res.body).eql({
								elements: [expected],
								pageNumber: 0,
								pageSize: 20,
								totalPages: 1,
								totalSize: 1
							});
						} else {
							should(res.body).eql({
								message: 'This is a fake error message'
							});
						}
					})
					.end(done);
			});
		});
	});

	describe('PATCH /admin/feedback/:feedbackId/status', () => {
		let savedFeedback;

		before(async () => {
			await Feedback.deleteMany({}).exec();
			savedFeedback = await new Feedback({
				body: 'testing',
				url: 'http://localhost:3000/home',
				type: 'Question'
			}).save();
		});

		[
			{
				name: 'should not update feedback status as non-admin',
				isAdmin: false
			},
			{ name: 'should update feedback status as admin', isAdmin: true }
		].forEach((testConfig) => {
			it(testConfig.name, (done) => {
				const updatedStatus = 'Closed';
				setAdmin(testConfig.isAdmin);
				request(app)
					.patch(`/admin/feedback/${savedFeedback._id}/status`)
					.send({ status: updatedStatus })
					.expect('Content-Type', /json/)
					.expect(testConfig.isAdmin ? 200 : 403)
					.expect((res) => {
						if (testConfig.isAdmin) {
							const expected = savedFeedback.toJSON();
							expected._id = expected._id.toString();
							expected.status = updatedStatus;
							// Verify that the 'updated' field was updated
							should(res.body.updated).greaterThan(
								expected.updated
							);
							// Set the expected 'updated' value to be the received value so the match can be performed
							expected.updated = res.body.updated;
							should(res.body).match(expected);
						} else {
							should(res.body).eql({
								message: 'This is a fake error message'
							});
						}
					})
					.end(done);
			});
		});
	});

	describe('PATCH /admin/feedback/:feedbackId/assignee', () => {
		let savedFeedback;

		before(async () => {
			await Feedback.deleteMany({}).exec();
			savedFeedback = await new Feedback({
				body: 'testing',
				url: 'http://localhost:3000/home',
				type: 'Question'
			}).save();
		});

		[
			{
				name: 'should not update feedback assignee as non-admin',
				isAdmin: false
			},
			{ name: 'should update feedback assignee as admin', isAdmin: true }
		].forEach((testConfig) => {
			it(testConfig.name, (done) => {
				const updatedAssignee = fakeUser.username;
				setAdmin(testConfig.isAdmin);
				request(app)
					.patch(`/admin/feedback/${savedFeedback._id}/assignee`)
					.send({ assignee: updatedAssignee })
					.expect('Content-Type', /json/)
					.expect(testConfig.isAdmin ? 200 : 403)
					.expect((res) => {
						if (testConfig.isAdmin) {
							const expected = savedFeedback.toJSON();
							expected._id = expected._id.toString();
							expected.assignee = updatedAssignee;

							// Verify that the 'updated' field was updated
							should(res.body.updated).greaterThan(
								expected.updated
							);
							// Set the expected 'updated' value to be the received value so the match can be performed
							expected.updated = res.body.updated;
							should(res.body).match(expected);
						} else {
							should(res.body).eql({
								message: 'This is a fake error message'
							});
						}
					})
					.end(done);
			});
		});
	});
});
