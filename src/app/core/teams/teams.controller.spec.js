'use strict';

const
	should = require('should'),
	sinon = require('sinon'),
	teamsController = require('./teams.controller'),
	teamsService = require('./teams.service'),
	deps = require('../../../dependencies');

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
			end: sinon.spy()
		};
		res.status = sinon.stub().returns(res);
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('create', () => {
		it ('create successful', async () => {
			const req = {
				body: {},
				user: {
					toObject: () => { return {}; }
				}
			};
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'createTeam').resolves(undefined);

			await teamsController.create(req, res);

			sinon.assert.calledOnce(teamsService.createTeam);
			sinon.assert.calledOnce(deps.auditService.audit);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});

		it ('error thrown on create', async () => {
			const req = {
				body: {},
				user: {
					toObject: () => { return {}; }
				}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(teamsService, 'createTeam').throws('error');

			await teamsController.create(req, res);

			sinon.assert.calledOnce(teamsService.createTeam);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});
	});

	describe('read', () => {
		it ('persona found', async () => {
			const req = {
				team: {
					_id: '12345'
				},
				user: {
					toObject: () => { return {}; }
				}
			};

			await teamsController.read(req, res);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('update', () => {
		it ('team not found', async () => {
			const req = {};
			await teamsController.update(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'Could not find team' }));
		});

		it ('team found', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				}
			};

			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'updateTeam').resolves();

			await teamsController.update(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.updateTeam);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});

		it ('team found, error thrown on update', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {
					title: 'text eua title',
					text: 'test eua content'
				}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'updateTeam').throws('error');

			await teamsController.update(req, res);

			sinon.assert.calledOnce(teamsService.updateTeam);
			sinon.assert.notCalled(deps.auditService.audit);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});
	});

	describe('delete', () => {
		it ('team not found', async () => {
			const req = {};
			await teamsController.delete(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'Could not find team' }));
		});

		it ('team found', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'deleteTeam').resolves();

			await teamsController.delete(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.deleteTeam);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});

		it ('team found, error thrown on remove', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'deleteTeam').throws('error');

			await teamsController.delete(req, res);

			sinon.assert.calledOnce(teamsService.deleteTeam);
			sinon.assert.notCalled(deps.auditService.audit);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});
	});

	describe('search', () => {
		it ('search returns teams', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(teamsService, 'searchTeams').resolves();

			await teamsController.search(req, res);

			sinon.assert.calledOnce(teamsService.searchTeams);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});

		it ('search throws error', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(teamsService, 'searchTeams').throws('error');

			await teamsController.search(req, res);

			sinon.assert.calledOnce(teamsService.searchTeams);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});
	});

	describe('requestNewTeam', () => {
		it('request handled', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'requestNewTeam').resolves();

			await teamsController.requestNewTeam(req, res);

			sinon.assert.calledOnce(teamsService.requestNewTeam);
			sinon.assert.calledOnce(deps.auditService.audit);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
		});

		it('error thrown handling request', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'requestNewTeam').throws('error');

			await teamsController.requestNewTeam(req, res);

			sinon.assert.calledOnce(teamsService.requestNewTeam);
			sinon.assert.notCalled(deps.auditService.audit);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});

	});

	describe('requestAccess', () => {
		it ('team not found', async () => {
			const req = {};
			await teamsController.requestAccess(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'Could not find team' }));
		});

		it('request handled', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(teamsService, 'requestAccessToTeam').resolves();

			await teamsController.requestAccess(req, res);

			sinon.assert.calledOnce(teamsService.requestAccessToTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
		});

		it('error thrown handling request', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(teamsService, 'requestAccessToTeam').throws('error');

			await teamsController.requestAccess(req, res);

			sinon.assert.calledOnce(teamsService.requestAccessToTeam);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});

	});

	describe('searchMembers', () => {
		it ('search returns team members', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(teamsService, 'searchTeamMembers').resolves();

			await teamsController.searchMembers(req, res);

			sinon.assert.calledOnce(teamsService.searchTeamMembers);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});

		it ('search throws error', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(teamsService, 'searchTeamMembers').throws('error');

			await teamsController.searchMembers(req, res);

			sinon.assert.calledOnce(teamsService.searchTeamMembers);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});
	});

	describe('addMember', () => {
		it ('team not found', async () => {
			const req = {};
			await teamsController.addMember(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'Could not find team' }));
		});

		it('request handled', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'addMemberToTeam').resolves();

			await teamsController.addMember(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.addMemberToTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
		});

		it('error thrown handling request', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'addMemberToTeam').throws('error');

			await teamsController.addMember(req, res);

			sinon.assert.notCalled(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.addMemberToTeam);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});

	});

	describe('addMembers', () => {
		it ('team not found', async () => {
			const req = {};
			await teamsController.addMembers(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'Could not find team' }));
		});

		it ('team members not found', async () => {
			const req = {
				team: { _id: '12345'},
				body: {}
			};
			await teamsController.addMembers(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'New team members not specified' }));
		});

		it('team members empty array', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: { newMembers: [] }
			};

			await teamsController.addMembers(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'New team members not specified' }));
		});

		it('request handled', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {
					newMembers: [{
						_id: '12345',
						role: 'admin'
					}, {
						_id: '11111',
						role: 'admin'
					}]
				}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			const readTeamMemberStub = sandbox.stub(teamsService, 'readTeamMember');
			readTeamMemberStub.onCall(0).resolves({});
			readTeamMemberStub.onCall(1).resolves();
			sandbox.stub(teamsService, 'addMemberToTeam').resolves();

			await teamsController.addMembers(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.addMemberToTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
		});

		it('error thrown handling request', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {
					newMembers: [{
						_id: '12345',
						role: 'admin'
					}]
				}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'readTeamMember').resolves({});
			sandbox.stub(teamsService, 'addMemberToTeam').throws('error');

			await teamsController.addMembers(req, res);

			sinon.assert.notCalled(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.addMemberToTeam);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});

	});

	describe('removeMember', () => {
		it ('team not found', async () => {
			const req = {};
			await teamsController.removeMember(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'Could not find team' }));
		});

		it('request handled', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'removeMemberFromTeam').resolves();

			await teamsController.removeMember(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.removeMemberFromTeam);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
		});

		it('error thrown handling request', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'removeMemberFromTeam').throws('error');

			await teamsController.removeMember(req, res);

			sinon.assert.notCalled(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.removeMemberFromTeam);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});

	});

	describe('updateMemberRole', () => {
		it ('team not found', async () => {
			const req = {};
			await teamsController.updateMemberRole(req, res);

			sinon.assert.calledWith(res.status, 400);
			sinon.assert.calledWith(res.json, sinon.match({ status: 400, type: 'error', message: 'Could not find team' }));
		});

		it('request handled', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'updateMemberRole').resolves();

			await teamsController.updateMemberRole(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.updateMemberRole);

			sinon.assert.calledWith(res.status, 204);
			sinon.assert.called(res.end);
			sinon.assert.notCalled(res.json);
		});

		it('error thrown handling request', async () => {
			const req = {
				team: { _id: '12345' },
				user: {
					toObject: () => { return {}; }
				},
				body: {}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(teamsService, 'updateMemberRole').throws('error');

			await teamsController.updateMemberRole(req, res);

			sinon.assert.notCalled(deps.auditService.audit);
			sinon.assert.calledOnce(teamsService.updateMemberRole);

			sinon.assert.calledWith(res.status, 500);
			sinon.assert.calledWith(res.json, sinon.match({ status: 500, type: 'server-error' }));
		});

	});

	describe('teamById', () => {
		it('team found', async () => {
			sandbox.stub(teamsService, 'readTeam').resolves({
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
			sandbox.stub(teamsService, 'readTeam').resolves();

			const nextFn = sinon.stub();
			const req = { user: {} };

			await teamsController.teamById(req, {}, nextFn, 'id');

			should.not.exist(req.team);
			sinon.assert.calledWith(nextFn, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Could not find team')));
		});
	});

	describe('teamMemberById', () => {
		it('team found', async () => {
			sandbox.stub(teamsService, 'readTeamMember').resolves({
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
			sandbox.stub(teamsService, 'readTeamMember').resolves();

			const nextFn = sinon.stub();
			const req = { user: {} };

			await teamsController.teamMemberById(req, {}, nextFn, 'id');

			should.not.exist(req.userParam);
			sinon.assert.calledWith(nextFn, sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Failed to load team member')));
		});
	});

	describe('requiresRole', () => {
		['requiresAdmin', 'requiresEditor', 'requiresMember'].forEach((method) => {
			describe(method, () => {
				it('user not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = {};

					await teamsController[method](req)
						.should.be.rejectedWith({ status: 400, message: 'No user for request' });

					sinon.assert.notCalled(teamsService.meetsRoleRequirement);
				});

				it('team not found', async () => {
					sandbox.stub(teamsService, 'meetsRoleRequirement').resolves();

					const req = { user: {} };

					await teamsController[method](req)
						.should.be.rejectedWith({ status: 400, message: 'No team for request' });

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
