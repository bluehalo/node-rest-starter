'use strict';

const should = require('should'),
	sinon = require('sinon'),
	teamsController = require('./teams.controller'),
	teamsService = require('./teams.service'),
	userService = require('../user/user.service'),
	{ auditService, dbs, logger } = require('../../../dependencies');

const Team = dbs.admin.model('Team');
const User = dbs.admin.model('User');

/**
 * Unit tests
 */
describe('Teams Controller:', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		res = {
			json: sinon.spy(),
			end: sinon.spy(),
			status: sinon.stub()
		};
		res.status.returns(res);
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

			sinon.assert.calledOnce(teamsService.create);
			sinon.assert.calledOnce(auditService.audit);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('read', () => {
		it('persona found', async () => {
			const req = {
				team: new Team(),
				user: new User()
			};

			await teamsController.read(req, res);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
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

			sinon.assert.calledOnce(auditService.audit);
			sinon.assert.calledOnce(teamsService.update);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
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

			await teamsController.delete(req, res);

			sinon.assert.calledOnce(auditService.audit);
			sinon.assert.calledOnce(teamsService.delete);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('search', () => {
		it('search returns teams', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(teamsService, 'search').resolves();

			await teamsController.search(req, res);

			sinon.assert.calledOnce(teamsService.search);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
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

			sinon.assert.calledOnce(teamsService.requestNewTeam);
			sinon.assert.calledOnce(auditService.audit);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
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

			sinon.assert.calledOnce(teamsService.requestAccessToTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
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

			sinon.assert.calledOnce(userService.searchUsers);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
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

			sinon.assert.calledOnce(auditService.audit);
			sinon.assert.calledOnce(teamsService.addMemberToTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
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

			sinon.assert.calledOnce(auditService.audit);
			sinon.assert.calledOnce(teamsService.addMemberToTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
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

			sinon.assert.calledOnce(auditService.audit);
			sinon.assert.calledOnce(teamsService.removeMemberFromTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
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

			sinon.assert.calledOnce(auditService.audit);
			sinon.assert.calledOnce(teamsService.updateMemberRole);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
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

			const nextFn = sinon.stub();
			const req = { user: {}, body: {} };

			await teamsController.teamById(req, {}, nextFn, 'id');

			should.exist(req.team);
			sinon.assert.calledWith(nextFn);
		});

		it('team not found', async () => {
			sandbox.stub(teamsService, 'read').resolves();

			const nextFn = sinon.stub();
			const req = { user: {} };

			await teamsController.teamById(req, {}, nextFn, 'id');

			should.not.exist(req.team);
			sinon.assert.calledWith(
				nextFn,
				sinon.match
					.instanceOf(Error)
					.and(sinon.match.has('message', 'Could not find team'))
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

			const nextFn = sinon.stub();
			const req = { user: {}, body: {} };

			await teamsController.teamMemberById(req, {}, nextFn, 'id');

			should.exist(req.userParam);
			sinon.assert.calledWith(nextFn);
		});

		it('team not found', async () => {
			sandbox.stub(userService, 'read').resolves();

			const nextFn = sinon.stub();
			const req = { user: {} };

			await teamsController.teamMemberById(req, {}, nextFn, 'id');

			should.not.exist(req.userParam);
			sinon.assert.calledWith(
				nextFn,
				sinon.match
					.instanceOf(Error)
					.and(sinon.match.has('message', 'Failed to load team member'))
			);
		});
	});

	describe('requiresRole', () => {
		['requiresAdmin', 'requiresEditor', 'requiresMember'].forEach((method) => {
			describe(method, () => {
				it('user not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = {};

					await teamsController[method](req).should.be.rejectedWith({
						status: 400,
						message: 'No user for request'
					});

					sinon.assert.notCalled(teamsService.meetsRoleRequirement);
				});

				it('team not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = { user: {} };

					await teamsController[method](req).should.be.rejectedWith({
						status: 400,
						message: 'No team for request'
					});

					sinon.assert.notCalled(teamsService.meetsRoleRequirement);
				});

				it('team not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = { user: {}, team: {} };

					await teamsController[method](req).should.be.fulfilled();

					sinon.assert.calledOnce(teamsService.meetsRoleRequirement);
				});
			});
		});
	});
});
