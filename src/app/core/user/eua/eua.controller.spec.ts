import { Request } from 'express';
import should from 'should';
import { assert, createSandbox, match, spy, stub } from 'sinon';

import * as euaController from './eua.controller';
import { UserAgreement, UserAgreementDocument } from './eua.model';
import euaService from './eua.service';
import { auditService, logger } from '../../../../dependencies';
import { User } from '../user.model';

/**
 * Unit tests
 */
describe('EUA Controller:', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		res = {
			json: spy(),
			status: stub()
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

			assert.calledOnce(euaService.search);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('acceptEua', () => {
		it('accept eua is successful', async () => {
			const req = {
				user: new User({})
			};

			sandbox.stub(euaService, 'acceptEua').resolves(req.user);

			await euaController.acceptEua(req, res);

			assert.calledOnce(euaService.acceptEua);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('publishEua', () => {
		it('eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(euaService, 'publishEua').resolves(req.euaParam);

			await euaController.publishEua(req, res);

			assert.calledOnce(euaService.publishEua);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('createEua', () => {
		it('create successful', async () => {
			const req = {
				body: {},
				user: new User({})
			};
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(euaService, 'create').resolves(new UserAgreement());

			await euaController.createEua(req, res);

			assert.calledOnce(euaService.create);
			assert.calledOnce(auditService.audit);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('getCurrentEua', () => {
		it('current eua not found', async () => {
			const req = {};
			await euaController.getCurrentEua(req, res);

			sandbox.stub(euaService, 'getCurrentEua').resolves(null);

			await euaController.getCurrentEua(req, res);

			assert.calledOnce(euaService.getCurrentEua);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});

		it('current eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			sandbox.stub(euaService, 'getCurrentEua').resolves({});

			await euaController.getCurrentEua(req, res);

			assert.calledOnce(euaService.getCurrentEua);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('read', () => {
		it('eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			await euaController.read(req, res);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('updateEua', () => {
		it('eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(euaService, 'update').resolves(req.euaParam);

			await euaController.updateEua(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(euaService.update);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('deleteEua', () => {
		it('eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			sandbox.stub(logger, 'error').returns();
			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(euaService, 'delete').resolves(req.euaParam);

			await euaController.deleteEua(req, res);

			assert.calledOnce(auditService.audit);
			assert.calledOnce(euaService.delete);

			assert.calledWith(res.status, 200);
			assert.called(res.json);
		});
	});

	describe('euaById', () => {
		it('eua found', async () => {
			sandbox.stub(euaService, 'read').resolves({});

			const nextFn = stub();
			const req = {} as Request & {
				euaParam: UserAgreementDocument;
			};

			await euaController.euaById(req, {}, nextFn, 'id');

			should.exist(req.euaParam);
			assert.calledWith(nextFn);
		});

		it('eua not found', async () => {
			sandbox.stub(euaService, 'read').resolves();

			const nextFn = stub();
			const req = {} as Request & {
				euaParam: UserAgreementDocument;
			};

			await euaController.euaById(req, {}, nextFn, 'id');

			should.not.exist(req.euaParam);
			assert.calledWith(
				nextFn,
				match
					.instanceOf(Error)
					.and(match.has('message', 'Failed to load User Agreement id'))
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
