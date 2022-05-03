'use strict';

const should = require('should'),
	sinon = require('sinon'),
	deps = require('../../../../dependencies'),
	userService = require('../user.service'),
	userAuthorizationService = require('../auth/user-authorization.service'),
	userProfileService = require('./user-profile.service'),
	User = deps.dbs.admin.model('User'),
	userProfileController = require('./user-profile.controller');

/**
 * Unit tests
 */
describe('User Profile Controller:', () => {
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

	describe('getCurrentUser', () => {
		it('user is logged in (user attached to request)', async () => {
			const req = {
				body: {},
				user: new User()
			};

			sandbox.stub(userAuthorizationService, 'updateRoles').resolves();

			await userProfileController.getCurrentUser(req, res);

			sinon.assert.calledOnce(userAuthorizationService.updateRoles);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});

		it('user is not logged in (user not attached to request)', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(userAuthorizationService, 'updateRoles').resolves();

			await userProfileController.getCurrentUser(req, res);

			sinon.assert.notCalled(userAuthorizationService.updateRoles);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWithMatch(res.json, {
				message: 'User is not logged in'
			});
		});
	});

	describe('updateCurrentUser', () => {
		it('user is logged in; success', async () => {
			const user = new User();
			user.save = () => Promise.resolve(user);
			const req = {
				body: {},
				user: user,
				login: (u, callback) => {
					callback();
				}
			};

			sandbox.stub(User, 'findById').returns({
				exec: () => Promise.resolve(user)
			});
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(deps.utilService, 'send400Error').resolves();

			await userProfileController.updateCurrentUser(req, res);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.calledWithMatch(res.json, { id: user.id });

			sinon.assert.calledWithMatch(deps.auditService.audit, 'user updated');

			sinon.assert.notCalled(deps.utilService.send400Error);
		});

		it('user is logged in; success w/ password change', async () => {
			const user = new User();
			user.password = 'oldPassword';
			user.save = () => Promise.resolve(user);
			const req = {
				body: {
					currentPassword: 'oldPassword',
					password: 'newPassword'
				},
				user: user,
				login: (u, callback) => {
					callback();
				}
			};

			sandbox.stub(User, 'findById').returns({
				exec: () => Promise.resolve(user)
			});
			sandbox.stub(deps.auditService, 'audit').resolves();

			await userProfileController.updateCurrentUser(req, res);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.calledWithMatch(res.json, {});

			sinon.assert.calledWithMatch(deps.auditService.audit, 'user updated');
		});

		it('user is logged in; changing password, currentPassword incorrect', async () => {
			const user = new User();
			user.password = 'differentPassword';

			const req = {
				body: {
					currentPassword: 'oldPassword',
					password: 'newPassword'
				},
				user: user
			};

			sandbox.stub(User, 'findById').returns({
				exec: () => Promise.resolve(user)
			});
			sandbox.stub(deps.auditService, 'audit').resolves();

			await userProfileController.updateCurrentUser(req, res);

			sinon.assert.calledWithMatch(
				deps.auditService.audit,
				'user update authentication failed'
			);
		});

		it('user is logged in; save returns error', async () => {
			const user = new User();
			user.password = 'oldPassword';
			user.save = () => Promise.reject('error');
			const req = {
				body: {
					currentPassword: 'oldPassword',
					password: 'newPassword'
				},
				user: user,
				login: (u, callback) => {
					callback('error');
				}
			};

			sandbox.stub(User, 'findById').returns({
				exec: () => Promise.resolve(user)
			});
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(deps.utilService, 'send400Error').resolves();

			await userProfileController.updateCurrentUser(req, res);

			sinon.assert.notCalled(res.status);
			sinon.assert.notCalled(res.json);

			sinon.assert.notCalled(deps.auditService.audit);
			sinon.assert.calledOnce(deps.utilService.send400Error);
		});

		it('user is logged in; login returns error', async () => {
			const user = new User();
			user.password = 'oldPassword';
			user.save = () => Promise.resolve(user);
			const req = {
				body: {
					currentPassword: 'oldPassword',
					password: 'newPassword'
				},
				user: user,
				login: (u, callback) => {
					callback('error');
				}
			};

			sandbox.stub(User, 'findById').returns({
				exec: () => Promise.resolve(user)
			});
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(deps.utilService, 'send400Error').resolves();

			await userProfileController.updateCurrentUser(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWithMatch(res.json, 'error');

			sinon.assert.calledWithMatch(deps.auditService.audit, 'user updated');

			sinon.assert.notCalled(deps.utilService.send400Error);
		});

		it('user is not logged in', async () => {
			const req = {
				body: {}
			};

			await userProfileController.updateCurrentUser(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWithMatch(res.json, {
				message: 'User is not logged in'
			});
		});
	});

	describe('updatePreferences', () => {
		it('user is logged in (user attached to request)', async () => {
			const req = {
				body: {},
				user: new User()
			};

			sandbox.stub(userProfileService, 'updatePreferences').resolves();

			await userProfileController.updatePreferences(req, res);

			sinon.assert.calledOnce(userProfileService.updatePreferences);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('updateRequiredOrgs', () => {
		it('user is logged in (user attached to request)', async () => {
			const req = {
				body: {},
				user: new User()
			};

			sandbox.stub(userProfileService, 'updateRequiredOrgs').resolves();

			await userProfileController.updateRequiredOrgs(req, res);

			sinon.assert.calledOnce(userProfileService.updateRequiredOrgs);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('getUserById', () => {
		it('user is found', async () => {
			const req = {
				body: {},
				userParam: new User()
			};

			await userProfileController.getUserById(req, res);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('searchUsers', () => {
		let req;
		beforeEach(() => {
			req = {
				body: {},
				user: new User()
			};

			sandbox.stub(deps.utilService, 'handleErrorResponse').resolves();
		});

		it('search returns successfully', async () => {
			sandbox.stub(userService, 'searchUsers').resolves({
				elements: []
			});

			await userProfileController.searchUsers(req, res);

			sinon.assert.calledOnce(userService.searchUsers);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.calledOnce(res.json);
		});
	});

	describe('matchUsers', () => {
		let req;
		beforeEach(() => {
			req = {
				body: {},
				user: new User()
			};

			sandbox.stub(deps.utilService, 'handleErrorResponse').resolves();
		});

		it('search returns successfully', async () => {
			sandbox.stub(userService, 'searchUsers').resolves({
				elements: []
			});

			await userProfileController.matchUsers(req, res);

			sinon.assert.calledOnce(userService.searchUsers);
			sinon.assert.notCalled(deps.utilService.handleErrorResponse);
			sinon.assert.calledWith(res.status, 200);
			sinon.assert.calledOnce(res.json);
		});
	});

	describe('canEditProfile', () => {
		it('local auth and undef bypass should be able to edit', () => {
			const _user = {};
			const result = userProfileController.canEditProfile('local', _user);
			result.should.equal(true);
		});

		it('local auth and no bypass should be able to edit', () => {
			const _user = { bypassAccessCheck: false };
			const result = userProfileController.canEditProfile('local', _user);
			result.should.equal(true);
		});

		it('local auth and bypass should be able to edit', () => {
			const _user = { bypassAccessCheck: true };
			const result = userProfileController.canEditProfile('local', _user);
			result.should.equal(true);
		});

		it('proxy-pki auth and undef bypass should not be able to edit', () => {
			const _user = {};
			const result = userProfileController.canEditProfile('proxy-pki', _user);
			result.should.equal(false);
		});

		it('proxy-pki auth and no bypass should not be able to edit', () => {
			const _user = { bypassAccessCheck: false };
			const result = userProfileController.canEditProfile('proxy-pki', _user);
			result.should.equal(false);
		});

		it('proxy-pki auth and bypass should be able to edit', () => {
			const _user = { bypassAccessCheck: true };
			const result = userProfileController.canEditProfile('proxy-pki', _user);
			result.should.equal(true);
		});
	});

	describe('hasEdit', () => {
		it('user has edit', async () => {
			const req = {
				body: {}
			};

			const canEditProfile = userProfileController.canEditProfile;
			userProfileController.canEditProfile = () => true;

			let error;
			try {
				await userProfileController.hasEdit(req);
			} catch (err) {
				error = err;
			}

			should.not.exist(error);

			userProfileController.canEditProfile = canEditProfile;
		});

		it('user does not have edit', async () => {
			const req = {
				body: {}
			};

			const canEditProfile = userProfileController.canEditProfile;
			userProfileController.canEditProfile = () => false;

			let error;
			try {
				await userProfileController.hasEdit(req);
			} catch (err) {
				error = err;
			}

			should.exist(error);
			error.status.should.equal(403);
			error.message.should.equal('User not authorized to edit their profile');

			userProfileController.canEditProfile = canEditProfile;
		});
	});
});
