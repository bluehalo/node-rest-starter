import assert from 'node:assert/strict';

import { assert as sinonAssert, createSandbox } from 'sinon';

import * as userAdminController from './user-admin.controller';
import { auditService, config } from '../../../../dependencies';
import { getResponseSpy } from '../../../../spec/helpers';
import { BadRequestError } from '../../../common/errors';
import userEmailService from '../user-email.service';
import { User } from '../user.model';
import userService from '../user.service';

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
		sandbox = createSandbox();
		res = getResponseSpy();
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

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			await userAdminController.adminGetAll(req, res);

			sinonAssert.calledOnce(User.find);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.calledWithMatch(res.json, []);
		});

		it('returns successfully w/ results', async () => {
			const req = {
				body: { field: 'name' }
			};

			sandbox.stub(User, 'find').returns({
				exec: () => Promise.resolve([userSpec('user1'), userSpec('user2')])
			});

			await userAdminController.adminGetAll(req, res);

			sinonAssert.calledOnce(User.find);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.calledWithMatch(res.json, ['user1 Name', 'user2 Name']);
		});

		it('query field undefined; returns error', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(User, 'find').returns({
				exec: () => Promise.resolve([])
			});

			await assert.rejects(
				userAdminController.adminGetAll(req, res),
				new BadRequestError('Query field must be provided')
			);

			sinonAssert.notCalled(User.find);
		});

		it('query field is empty string; returns error', async () => {
			const req = {
				body: { field: '' }
			};

			sandbox.stub(User, 'find').returns({
				exec: () => Promise.resolve([])
			});

			await assert.rejects(
				userAdminController.adminGetAll(req, res),
				new BadRequestError('Query field must be provided')
			);

			sinonAssert.notCalled(User.find);
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

			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(userEmailService, 'emailApprovedUser').resolves();
		});

		it('user is found', async () => {
			sandbox.stub(userService, 'update').resolves(req.user);

			sandbox
				.stub(config, 'coreEmails')
				.value({ approvedUserEmail: { enabled: true } });
			await userAdminController.adminUpdateUser(req, res);

			sinonAssert.calledWithMatch(auditService.audit, 'admin user updated');
			sinonAssert.notCalled(userEmailService.emailApprovedUser);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});

		it('user is found; password is updated', async () => {
			req.body.password = 'newPassword';

			sandbox.stub(userService, 'update').resolves(req.user);

			await userAdminController.adminUpdateUser(req, res);

			sinonAssert.calledWithMatch(auditService.audit, 'admin user updated');
			sinonAssert.notCalled(userEmailService.emailApprovedUser);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});

		it('user is found; approved user email sent', async () => {
			req.body.roles = { user: true };

			sandbox.stub(userService, 'update').resolves();

			await userAdminController.adminUpdateUser(req, res);

			sinonAssert.calledWithMatch(auditService.audit, 'admin user updated');
			sinonAssert.calledOnce(userEmailService.emailApprovedUser);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			sandbox.stub(auditService, 'audit').resolves();
		});

		it('user is found', async () => {
			sandbox.stub(userService, 'remove').resolves();

			await userAdminController.adminDeleteUser(req, res);

			sinonAssert.calledWithMatch(auditService.audit, 'admin user deleted');
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});
	});

	describe('adminSearchUsers', () => {
		const req = {
			body: {} as Record<string, unknown>,
			user: userSpec('user1')
		};

		it('search returns successfully', async () => {
			sandbox.stub(userService, 'searchUsers').resolves({
				elements: [userSpec('user1'), userSpec('user2')]
			});

			await userAdminController.adminSearchUsers(req, res);

			sinonAssert.calledOnce(userService.searchUsers);
			sinonAssert.calledWith(res.status, 200);
			sinonAssert.calledOnce(res.json);
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
					const configGetStub = sandbox.stub(config, 'get');
					configGetStub.withArgs('auth.roleStrategy').returns(strategy);
					configGetStub.callThrough();
				});
			});

			afterEach(async () => {
				await userAdminController.adminSearchUsers(req, res);

				sinonAssert.calledOnce(userService.searchUsers);
				sinonAssert.calledWith(res.status, 200);
				sinonAssert.calledOnce(res.json);
			});
		});
	});
});
