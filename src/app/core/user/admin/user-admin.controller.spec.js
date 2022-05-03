'use strict';

const sinon = require('sinon'),
	deps = require('../../../../dependencies'),
	User = deps.dbs.admin.model('User'),
	userEmailService = require('../user-email.service'),
	userService = require('../user.service'),
	resourcesService = require('../../resources/resources.service'),
	userAdminController = require('./user-admin.controller');

/**
 * Helpers
 */
function userSpec(key) {
	return new User({
		name: `${key} Name`,
		email: `${key}@mail.com`,
		username: `${key}_username`,
		password: 'password',
		provider: 'local',
		organization: `${key} Organization`
	});
}

/**
 * Unit tests
 */
describe('User Admin Controller:', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		res = {
			json: sinon.spy(),
			status: sinon.stub()
		};
		res.status.returns(res);
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('adminGetUser', () => {
		it('user is found', async () => {
			const req = {
				body: {},
				userParam: new User()
			};

			await userAdminController.adminGetUser(req, res);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('adminGetAll', () => {
		it('returns successfully w/ no results', async () => {
			const req = {
				body: { field: 'name' }
			};

			sandbox.stub(User, 'find').returns({
				exec: () => Promise.resolve([])
			});
			sandbox.stub(deps.utilService, 'handleErrorResponse').returns();

			await userAdminController.adminGetAll(req, res);

			sinon.assert.calledOnce(User.find);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.calledWithMatch(res.json, []);
		});

		it('returns successfully w/ results', async () => {
			const req = {
				body: { field: 'name' }
			};

			sandbox.stub(User, 'find').returns({
				exec: () => Promise.resolve([userSpec('user1'), userSpec('user2')])
			});
			sandbox.stub(deps.utilService, 'handleErrorResponse').returns();

			await userAdminController.adminGetAll(req, res);

			sinon.assert.calledOnce(User.find);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.calledWithMatch(res.json, ['user1 Name', 'user2 Name']);
		});

		it('query field undefined; returns error', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(User, 'find').returns({
				exec: () => Promise.resolve([])
			});
			sandbox.stub(deps.utilService, 'handleErrorResponse').returns();

			await userAdminController.adminGetAll(req, res);

			sinon.assert.notCalled(User.find);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWithMatch(res.json, {
				message: 'Query field must be provided'
			});
		});

		it('query field is empty string; returns error', async () => {
			const req = {
				body: { field: '' }
			};

			sandbox.stub(User, 'find').returns({
				exec: () => Promise.resolve([])
			});

			await userAdminController.adminGetAll(req, res);

			sinon.assert.notCalled(User.find);
			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWithMatch(res.json, {
				message: 'Query field must be provided'
			});
		});
	});

	describe('adminUpdateUser', () => {
		let req;
		beforeEach(() => {
			req = {
				body: {},
				user: userSpec('currentUser'),
				userParam: userSpec('user1')
			};

			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(deps.utilService, 'handleErrorResponse').resolves();
			sandbox.stub(userEmailService, 'emailApprovedUser').resolves();
			sandbox.stub(resourcesService, 'deleteResourcesWithOwner').resolves();
		});

		it('user is found', async () => {
			sandbox.stub(userService, 'update').resolves();

			sandbox
				.stub(deps.config, 'coreEmails')
				.value({ approvedUserEmail: { enabled: true } });
			await userAdminController.adminUpdateUser(req, res);

			sinon.assert.calledWithMatch(
				deps.auditService.audit,
				'admin user updated'
			);
			sinon.assert.notCalled(userEmailService.emailApprovedUser);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
		});

		it('user is found; password is updated', async () => {
			req.body.password = 'newPassword';

			sandbox.stub(userService, 'update').resolves();

			await userAdminController.adminUpdateUser(req, res);

			sinon.assert.calledWithMatch(
				deps.auditService.audit,
				'admin user updated'
			);
			sinon.assert.notCalled(userEmailService.emailApprovedUser);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
		});

		it('user is found; approved user email sent', async () => {
			req.body.roles = { user: true };

			sandbox.stub(userService, 'update').resolves();

			await userAdminController.adminUpdateUser(req, res);

			sinon.assert.calledWithMatch(
				deps.auditService.audit,
				'admin user updated'
			);
			sinon.assert.calledOnce(userEmailService.emailApprovedUser);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
		});
	});

	describe('adminDeleteUser', () => {
		let req;
		beforeEach(() => {
			req = {
				body: {},
				user: userSpec('currentUser'),
				userParam: userSpec('user1')
			};

			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(resourcesService, 'deleteResourcesWithOwner').resolves();
			sandbox.stub(deps.utilService, 'handleErrorResponse').resolves();
		});

		it('user is found', async () => {
			sandbox.stub(userService, 'remove').resolves();

			await userAdminController.adminDeleteUser(req, res);

			sinon.assert.calledWithMatch(
				deps.auditService.audit,
				'admin user deleted'
			);
			sinon.assert.calledOnce(resourcesService.deleteResourcesWithOwner);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
		});
	});

	describe('adminSearchUsers', () => {
		const req = {
			body: {},
			user: userSpec('user1')
		};

		beforeEach(() => {
			sandbox.stub(deps.utilService, 'handleErrorResponse').resolves();
		});

		it('search returns successfully', async () => {
			sandbox.stub(userService, 'searchUsers').resolves({
				elements: [userSpec('user1'), userSpec('user2')]
			});

			await userAdminController.adminSearchUsers(req, res);

			sinon.assert.calledOnce(userService.searchUsers);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.calledOnce(res.json);
		});

		describe('search returns successfully; filters updated', () => {
			beforeEach(() => {
				req.body.q = { $or: [{ 'roles.user': true }] };

				sandbox.stub(userService, 'searchUsers').resolves({
					elements: []
				});
			});

			['external', 'hybrid'].forEach((strategy) => {
				it(`strategy = ${strategy}`, () => {
					sandbox.stub(deps.config.auth, 'roleStrategy').value(strategy);
				});
			});

			afterEach(async () => {
				await userAdminController.adminSearchUsers(req, res);

				sinon.assert.calledOnce(userService.searchUsers);
				sinon.assert.notCalled(deps.utilService.handleErrorResponse);
				sinon.assert.calledWith(res.status, 200);
				sinon.assert.calledOnce(res.json);
			});
		});
	});
});
