import { Request } from 'express';
import should from 'should';
import { assert, createSandbox, match, stub } from 'sinon';

import { Team, TeamDocument } from './team.model';
import * as teamsController from './teams.controller';
import teamsService from './teams.service';
import { auditService, logger } from '../../../dependencies';
import { getResponseSpy } from '../../../spec/helpers';
import { User, UserDocument } from '../user/user.model';
import userService from '../user/user.service';

/**
 * Unit tests
 */
describe('Teams Controller:', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		res = getResponseSpy();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('create', () => {
		it('create successful', async () => {
			const req = {
				body: {},
				user: new User()
			};
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'create').resolves(new Team());

			await teamsController.create(req, res);

			assert.calledOnce(teamsService.create);
			assert.calledOnce(auditService.audit);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('read', () => {
		it('persona found', async () => {
			const req = {
				team: new Team(),
				user: new User()
			};

			await teamsController.read(req, res);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('update', () => {
		it('team found', async () => {
			const req = {
				team: new Team(),
				user: new User()
			};

			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'update').resolves(req.team);

			await teamsController.update(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(teamsService.update);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('delete', () => {
		it('team found', async () => {
			const req = {
				team: new Team(),
				user: new User()
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'delete').resolves();

			await teamsController.deleteTeam(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(teamsService.delete);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('search', () => {
		it('search returns teams', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(teamsService, 'search').resolves();

			await teamsController.search(req, res);

			assert.calledOnce(teamsService.search);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('requestNewTeam', () => {
		it('request handled', async () => {
			const req = {
				team: new Team(),
				user: new User(),
				body: {}
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'requestNewTeam').resolves();

			await teamsController.requestNewTeam(req, res);

			assert.calledOnce(teamsService.requestNewTeam);
			assert.calledOnce(auditService.audit);

			assert.calledWith(res.status, 204);
			assert.called(res.end);
			assert.notCalled(res.json);
		});
	});

	describe('requestAccess', () => {
		it('request handled', async () => {
			const req = {
				team: new Team(),
				user: new User(),
				body: {}
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(teamsService, 'requestAccessToTeam').resolves();

			await teamsController.requestAccess(req, res);

			assert.calledOnce(teamsService.requestAccessToTeam);

			assert.calledWith(res.status, 204);
			assert.called(res.end);
			assert.notCalled(res.json);
		});
	});

	describe('searchMembers', () => {
		it('search returns team members', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(teamsService, 'updateMemberFilter').returns({});
			sandbox.stub(userService, 'searchUsers').resolves({ elements: [] });

			await teamsController.searchMembers(req, res);

			assert.calledOnce(userService.searchUsers);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('addMember', () => {
		it('request handled', async () => {
			const req = {
				team: new Team(),
				user: new User(),
				userParam: new User(),
				body: {}
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'addMemberToTeam').resolves();

			await teamsController.addMember(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(teamsService.addMemberToTeam);

			assert.calledWith(res.status, 204);
			assert.called(res.end);
			assert.notCalled(res.json);
		});
	});

	describe('addMembers', () => {
		it('request handled', async () => {
			const req = {
				team: new Team(),
				user: new User(),
				body: {
					newMembers: [
						{
							_id: '12345',
							role: 'admin'
						},
						{
							_id: '11111',
							role: 'admin'
						}
					]
				}
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(auditService, 'audit').resolves();
			const readUserStub = sandbox.stub(userService, 'read');
			readUserStub.onCall(0).resolves({});
			readUserStub.onCall(1).resolves();
			sandbox.stub(teamsService, 'addMemberToTeam').resolves();

			await teamsController.addMembers(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(teamsService.addMemberToTeam);

			assert.calledWith(res.status, 204);
			assert.called(res.end);
			assert.notCalled(res.json);
		});
	});

	describe('removeMember', () => {
		it('request handled', async () => {
			const req = {
				team: new Team(),
				user: new User(),
				userParam: new User(),
				body: {}
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'removeMemberFromTeam').resolves();

			await teamsController.removeMember(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(teamsService.removeMemberFromTeam);

			assert.calledWith(res.status, 204);
			assert.called(res.end);
			assert.notCalled(res.json);
		});
	});

	describe('updateMemberRole', () => {
		it('request handled', async () => {
			const req = {
				team: new Team(),
				user: new User(),
				userParam: new User(),
				body: {}
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'updateMemberRole').resolves();

			await teamsController.updateMemberRole(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(teamsService.updateMemberRole);

			assert.calledWith(res.status, 204);
			assert.called(res.end);
			assert.notCalled(res.json);
		});
	});

	describe('teamById', () => {
		it('team found', async () => {
			sandbox.stub(teamsService, 'read').resolves({
				toObject: () => {
					return {
						type: 'type',
						owner: {}
					};
				}
			});

			const nextFn = stub();
			const req = { user: {}, body: {} } as Request & { team: TeamDocument };

			await teamsController.teamById(req, {}, nextFn, 'id');

			should.exist(req.team);
			assert.calledWith(nextFn);
		});

		it('team not found', async () => {
			sandbox.stub(teamsService, 'read').resolves();

			const nextFn = stub();
			const req = { user: {} } as Request & { team: TeamDocument };

			await teamsController.teamById(req, {}, nextFn, 'id');

			should.not.exist(req.team);
			assert.calledWith(
				nextFn,
				match.instanceOf(Error).and(match.has('message', 'Could not find team'))
			);
		});
	});

	describe('teamMemberById', () => {
		it('team found', async () => {
			sandbox.stub(userService, 'read').resolves({
				toObject: () => {
					return {
						type: 'type',
						owner: {}
					};
				}
			});

			const nextFn = stub();
			const req = { user: {}, body: {} } as Request & {
				userParam: UserDocument;
			};

			await teamsController.teamMemberById(req, {}, nextFn, 'id');

			should.exist(req.userParam);
			assert.calledWith(nextFn);
		});

		it('team not found', async () => {
			sandbox.stub(userService, 'read').resolves();

			const nextFn = stub();
			const req = { user: {} } as Request & { userParam: UserDocument };

			await teamsController.teamMemberById(req, {}, nextFn, 'id');

			should.not.exist(req.userParam);
			assert.calledWith(
				nextFn,
				match
					.instanceOf(Error)
					.and(match.has('message', 'Failed to load team member'))
			);
		});
	});

	describe('requiresRole', () => {
		const requiresRoleHelper = (method, testFunction) => {
			describe(method, () => {
				it('user not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = {};

					await testFunction(req).should.be.rejectedWith({
						status: 400,
						message: 'No user for request'
					});

					assert.notCalled(teamsService.meetsRoleRequirement);
				});

				it('team not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = { user: {} };

					await testFunction(req).should.be.rejectedWith({
						status: 400,
						message: 'No team for request'
					});

					assert.notCalled(teamsService.meetsRoleRequirement);
				});

				it('team not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = { user: {}, team: {} };

					await testFunction(req).should.be.fulfilled();

					assert.calledOnce(teamsService.meetsRoleRequirement);
				});
			});
		};

		requiresRoleHelper('requiresAdmin', teamsController.requiresAdmin);

		requiresRoleHelper('requiresEditor', teamsController.requiresEditor);

		requiresRoleHelper('requiresMember', teamsController.requiresMember);
	});
});
