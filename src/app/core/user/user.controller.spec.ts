import assert from 'node:assert/strict';

import { assert as sinonAssert, createSandbox } from 'sinon';

import userAuthorizationService from './auth/user-authorization.service';
import * as userController from './user.controller';
import { User } from './user.model';
import userService from './user.service';
import { auditService, config } from '../../../dependencies';
import { getResponseSpy } from '../../../spec/helpers';
import {
	BadRequestError,
	ForbiddenError,
	UnauthorizedError
} from '../../common/errors';

/**
 * Unit tests
 */
describe('User Profile Controller:', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		res = getResponseSpy();
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

			sinonAssert.calledOnce(userAuthorizationService.updateRoles);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});

		it('user is not logged in (user not attached to request)', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(userAuthorizationService, 'updateRoles').resolves();

			await assert.rejects(
				userController.getCurrentUser(req, res),
				new UnauthorizedError('User is not logged in')
			);

			sinonAssert.notCalled(userAuthorizationService.updateRoles);
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

			sandbox.stub(userService, 'read').resolves(user);
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.calledWithMatch(res.json, { id: user.id });

			sinonAssert.calledWithMatch(auditService.audit, 'user updated');
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
			user.auditCopy();

			sandbox.stub(userService, 'read').resolves(user);
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.calledWithMatch(res.json, {});

			sinonAssert.calledWithMatch(auditService.audit, 'user updated');
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

			sandbox.stub(userService, 'read').resolves(user);
			sandbox.stub(auditService, 'audit').resolves();

			await assert.rejects(
				userController.updateCurrentUser(req, res),
				new BadRequestError('Current password invalid')
			);

			sinonAssert.calledWithMatch(
				auditService.audit,
				'user update authentication failed'
			);
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

			sandbox.stub(userService, 'read').resolves(user);
			sandbox.stub(auditService, 'audit').resolves();

			await userController.updateCurrentUser(req, res);

			sinonAssert.calledWith(res.status, 400);
			sinonAssert.calledWithMatch(res.json, 'error');

			sinonAssert.calledWithMatch(auditService.audit, 'user updated');
		});

		it('user is not logged in', async () => {
			const req = {
				body: {}
			};

			await assert.rejects(
				userController.updateCurrentUser(req, res),
				new BadRequestError('User is not logged in')
			);
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

			sinonAssert.calledOnce(userService.updatePreferences);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			sinonAssert.calledOnce(userService.updateRequiredOrgs);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});
	});

	describe('getUserById', () => {
		it('user is found', async () => {
			const req = {
				body: {},
				userParam: new User()
			};

			await userController.getUserById(req, res);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			sinonAssert.calledOnce(userService.searchUsers);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.calledOnce(res.json);
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

			sinonAssert.calledOnce(userService.searchUsers);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.calledOnce(res.json);
		});
	});

	describe('canEditProfile', () => {
		it('local auth and undef bypass should be able to edit', () => {
			const _user = new User();
			const result = userController.canEditProfile('local', _user);
			assert.equal(result, true);
		});

		it('local auth and no bypass should be able to edit', () => {
			const _user = new User({ bypassAccessCheck: false });
			const result = userController.canEditProfile('local', _user);
			assert.equal(result, true);
		});

		it('local auth and bypass should be able to edit', () => {
			const _user = new User({ bypassAccessCheck: true });
			const result = userController.canEditProfile('local', _user);
			assert.equal(result, true);
		});

		it('proxy-pki auth and undef bypass should not be able to edit', () => {
			const _user = new User({});
			const result = userController.canEditProfile('proxy-pki', _user);
			assert.equal(result, false);
		});

		it('proxy-pki auth and no bypass should not be able to edit', () => {
			const _user = new User({ bypassAccessCheck: false });
			const result = userController.canEditProfile('proxy-pki', _user);
			assert.equal(result, false);
		});

		it('proxy-pki auth and bypass should be able to edit', () => {
			const _user = new User({ bypassAccessCheck: true });
			const result = userController.canEditProfile('proxy-pki', _user);
			assert.equal(result, true);
		});
	});

	describe('hasEdit', () => {
		it('user has edit', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.strategy').returns('proxy-pki');
			const req = {
				body: {},
				user: { bypassAccessCheck: true }
			};

			await assert.doesNotReject(userController.hasEdit(req));
		});

		it('user does not have edit', async () => {
			const configGetStub = sandbox.stub(config, 'get');
			configGetStub.withArgs('auth.strategy').returns('proxy-pki');
			const req = {
				body: {},
				user: { bypassAccessCheck: false }
			};

			await assert.rejects(
				userController.hasEdit(req),
				new ForbiddenError('User not authorized to edit their profile')
			);
		});
	});
});
