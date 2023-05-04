import should from 'should';
import { assert, createSandbox, spy, stub } from 'sinon';

import { auditService, config, dbs, logger } from '../../../dependencies';
import userAuthorizationService from './auth/user-authorization.service';
import * as userController from './user.controller';
import { UserModel } from './user.model';
import userService from './user.service';

const User = dbs.admin.model('User') as UserModel;

/**
 * Unit tests
 */
describe('User Profile Controller:', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		sandbox.stub(logger, 'error').returns();
		res = {
			json: spy(),
			status: stub()
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

			await userController.getCurrentUser(req, res);

			assert.calledOnce(userAuthorizationService.updateRoles);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});

		it('user is not logged in (user not attached to request)', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(userAuthorizationService, 'updateRoles').resolves();

			await userController.getCurrentUser(req, res);

			assert.notCalled(userAuthorizationService.updateRoles);

			assert.calledWith(res.status, 400);
			assert.calledWithMatch(res.json, {
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
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			assert.calledWith(res.status, 200);
			assert.calledWithMatch(res.json, { id: user.id });

			assert.calledWithMatch(auditService.audit, 'user updated');
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
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			assert.calledWith(res.status, 200);
			assert.calledWithMatch(res.json, {});

			assert.calledWithMatch(auditService.audit, 'user updated');
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
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			assert.calledWithMatch(
				auditService.audit,
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
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			assert.calledWith(res.status, 400);
			assert.calledWithMatch(res.json, { message: 'error' });

			assert.notCalled(auditService.audit);
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
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			assert.calledWith(res.status, 400);
			assert.calledWithMatch(res.json, 'error');

			assert.calledWithMatch(auditService.audit, 'user updated');
		});

		it('user is not logged in', async () => {
			const req = {
				body: {}
			};

			await userController.updateCurrentUser(req, res);

			assert.calledWith(res.status, 400);
			assert.calledWithMatch(res.json, {
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

			sandbox.stub(userService, 'updatePreferences').resolves();

			await userController.updatePreferences(req, res);

			assert.calledOnce(userService.updatePreferences);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('updateRequiredOrgs', () => {
		it('user is logged in (user attached to request)', async () => {
			const req = {
				body: {},
				user: new User()
			};

			sandbox.stub(userService, 'updateRequiredOrgs').resolves();

			await userController.updateRequiredOrgs(req, res);

			assert.calledOnce(userService.updateRequiredOrgs);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('getUserById', () => {
		it('user is found', async () => {
			const req = {
				body: {},
				userParam: new User()
			};

			await userController.getUserById(req, res);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('searchUsers', () => {
		let req;
		beforeEach(() => {
			req = {
				body: {},
				user: new User()
			};
		});

		it('search returns successfully', async () => {
			sandbox.stub(userService, 'searchUsers').resolves({
				elements: []
			});

			await userController.searchUsers(req, res);

			assert.calledOnce(userService.searchUsers);
			assert.calledWith(res.status, 200);
			assert.calledOnce(res.json);
		});
	});

	describe('matchUsers', () => {
		let req;
		beforeEach(() => {
			req = {
				body: {},
				user: new User()
			};
		});

		it('search returns successfully', async () => {
			sandbox.stub(userService, 'searchUsers').resolves({
				elements: []
			});

			await userController.matchUsers(req, res);

			assert.calledOnce(userService.searchUsers);
			assert.calledWith(res.status, 200);
			assert.calledOnce(res.json);
		});
	});

	describe('canEditProfile', () => {
		it('local auth and undef bypass should be able to edit', () => {
			const _user = {};
			const result = userController.canEditProfile('local', _user);
			result.should.equal(true);
		});

		it('local auth and no bypass should be able to edit', () => {
			const _user = { bypassAccessCheck: false };
			const result = userController.canEditProfile('local', _user);
			result.should.equal(true);
		});

		it('local auth and bypass should be able to edit', () => {
			const _user = { bypassAccessCheck: true };
			const result = userController.canEditProfile('local', _user);
			result.should.equal(true);
		});

		it('proxy-pki auth and undef bypass should not be able to edit', () => {
			const _user = {};
			const result = userController.canEditProfile('proxy-pki', _user);
			result.should.equal(false);
		});

		it('proxy-pki auth and no bypass should not be able to edit', () => {
			const _user = { bypassAccessCheck: false };
			const result = userController.canEditProfile('proxy-pki', _user);
			result.should.equal(false);
		});

		it('proxy-pki auth and bypass should be able to edit', () => {
			const _user = { bypassAccessCheck: true };
			const result = userController.canEditProfile('proxy-pki', _user);
			result.should.equal(true);
		});
	});

	describe('hasEdit', () => {
		it('user has edit', async () => {
			sandbox.stub(config.auth, 'strategy').value('proxy-pki');
			const req = {
				body: {},
				user: { bypassAccessCheck: true }
			};

			let error;
			try {
				await userController.hasEdit(req);
			} catch (err) {
				error = err;
			}

			should.not.exist(error);
		});

		it('user does not have edit', async () => {
			sandbox.stub(config.auth, 'strategy').value('proxy-pki');
			const req = {
				body: {},
				user: { bypassAccessCheck: false }
			};

			let error;
			try {
				await userController.hasEdit(req);
			} catch (err) {
				error = err;
			}

			should.exist(error);
			error.status.should.equal(403);
			error.message.should.equal('User not authorized to edit their profile');
		});
	});
});