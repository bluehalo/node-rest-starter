'use strict';

const should = require('should'),
	sinon = require('sinon'),
	euaController = require('./eua.controller'),
	euaService = require('./eua.service'),
	deps = require('../../../../dependencies');

/**
 * Unit tests
 */
describe('EUA Controller:', () => {
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

	describe('searchEuas', () => {
		it('search returns euas', async () => {
			const req = {
				body: {}
			};

			sandbox.stub(euaService, 'search').resolves();

			await euaController.searchEuas(req, res);

			sinon.assert.calledOnce(euaService.search);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('acceptEua', () => {
		it('accept eua is successful', async () => {
			const req = {
				user: {
					toObject: () => {
						return {};
					}
				}
			};

			sandbox.stub(euaService, 'acceptEua').resolves();

			await euaController.acceptEua(req, res);

			sinon.assert.calledOnce(euaService.acceptEua);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('publishEua', () => {
		it('eua found', async () => {
			const req = {
				euaParam: { _id: '12345' },
				user: {
					toObject: () => {
						return {};
					}
				}
			};

			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(euaService, 'publishEua').resolves();

			await euaController.publishEua(req, res);

			// sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(euaService.publishEua);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('createEua', () => {
		it('create successful', async () => {
			const req = {
				body: {},
				user: {
					toObject: () => {
						return {};
					}
				}
			};
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(euaService, 'create').resolves(null);

			await euaController.createEua(req, res);

			sinon.assert.calledOnce(euaService.create);
			sinon.assert.calledOnce(deps.auditService.audit);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('getCurrentEua', () => {
		it('current eua not found', async () => {
			const req = {};
			await euaController.getCurrentEua(req, res);

			sandbox.stub(euaService, 'getCurrentEua').resolves(null);

			await euaController.getCurrentEua(req, res);

			sinon.assert.calledOnce(euaService.getCurrentEua);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});

		it('current eua found', async () => {
			const req = {
				euaParam: { _id: '12345' },
				user: {
					toObject: () => {
						return {};
					}
				}
			};

			sandbox.stub(euaService, 'getCurrentEua').resolves({});

			await euaController.getCurrentEua(req, res);

			sinon.assert.calledOnce(euaService.getCurrentEua);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('read', () => {
		it('eua found', async () => {
			const req = {
				euaParam: { _id: '12345' },
				user: {
					toObject: () => {
						return {};
					}
				}
			};

			await euaController.read(req, res);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('updateEua', () => {
		it('eua found', async () => {
			const req = {
				euaParam: { _id: '12345' },
				user: {
					toObject: () => {
						return {};
					}
				}
			};

			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(euaService, 'update').resolves();

			await euaController.updateEua(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(euaService.update);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('deleteEua', () => {
		it('eua found', async () => {
			const req = {
				euaParam: { _id: '12345' },
				user: {
					toObject: () => {
						return {};
					}
				}
			};

			sandbox.stub(deps.logger, 'error').returns();
			sandbox.stub(deps.auditService, 'audit').resolves();
			sandbox.stub(euaService, 'remove').resolves();

			await euaController.deleteEua(req, res);

			sinon.assert.calledOnce(deps.auditService.audit);
			sinon.assert.calledOnce(euaService.remove);

			sinon.assert.calledWith(res.status, 200);
			sinon.assert.called(res.json);
		});
	});

	describe('euaById', () => {
		it('eua found', async () => {
			sandbox.stub(euaService, 'read').resolves({});

			const nextFn = sinon.stub();
			const req = {};

			await euaController.euaById(req, {}, nextFn, 'id');

			should.exist(req.euaParam);
			sinon.assert.calledWith(nextFn);
		});

		it('eua not found', async () => {
			sandbox.stub(euaService, 'read').resolves();

			const nextFn = sinon.stub();
			const req = {};

			await euaController.euaById(req, {}, nextFn, 'id');

			should.not.exist(req.euaParam);
			sinon.assert.calledWith(
				nextFn,
				sinon.match
					.instanceOf(Error)
					.and(sinon.match.has('message', 'Failed to load User Agreement id'))
			);
		});
	});

	describe('requiresEua:', () => {
		const successTests = [
			{
				currentEuaReturnValue: undefined,
				input: {},
				expected: undefined,
				description: 'Current eua is undefined'
			},
			{
				currentEuaReturnValue: null,
				expected: undefined,
				description: 'Current eua is null'
			},
			{
				currentEuaReturnValue: {},
				input: {},
				expected: undefined,
				description: 'Current eua is not published'
			},
			{
				currentEuaReturnValue: {
					published: 1
				},
				input: { user: { acceptedEua: 2 } },
				expected: undefined,
				description: 'Current eua is accepted'
			}
		];

		successTests.forEach((test) => {
			it(test.description, async () => {
				sandbox
					.stub(euaService, 'getCurrentEua')
					.resolves(test.currentEuaReturnValue);

				const result = await euaController.requiresEua(test.input);

				(result === test.expected).should.be.true(
					`expected ${result} to be ${test.expected}`
				);
			});
		});

		const euaNotAcceptedTests = [
			{
				currentEuaReturnValue: {
					published: 2
				},
				input: { user: {} },
				description: 'user has not accepted the current eua.'
			},
			{
				currentEuaReturnValue: {
					published: 2
				},
				input: { user: { acceptedEua: 1 } },
				description: 'User has accepted an older eua.'
			}
		];

		euaNotAcceptedTests.forEach((test) => {
			it(test.description, async () => {
				sandbox
					.stub(euaService, 'getCurrentEua')
					.resolves(test.currentEuaReturnValue);

				let err;
				try {
					await euaController.requiresEua(test.input);
				} catch (e) {
					err = e;
				}

				should.exist(err);
				err.status.should.equal(403);
				err.type.should.equal('eua');
				err.message.should.equal('User must accept end-user agreement.');
			});
		});

		it('Error thrown', async () => {
			sandbox.stub(euaService, 'getCurrentEua').rejects('error message');

			let err;
			try {
				await euaController.requiresEua({});
			} catch (e) {
				err = e;
			}

			should.exist(err);
			err.status.should.equal(500);
			err.type.should.equal('error');
			err.error.name.should.equal('error message');
		});
	});
});
