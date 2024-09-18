import assert from 'node:assert/strict';

import { Request } from 'express';
import { assert as sinonAssert, createSandbox, match, stub } from 'sinon';

import * as euaController from './eua.controller';
import { UserAgreement, UserAgreementDocument } from './eua.model';
import euaService from './eua.service';
import { auditService } from '../../../../dependencies';
import { getResponseSpy } from '../../../../spec/helpers';
import { ForbiddenError } from '../../../common/errors';
import { User } from '../user.model';

/**
 * Unit tests
 */
describe('EUA Controller:', () => {
	let res;
	let sandbox;

	beforeEach(() => {
		sandbox = createSandbox();
		res = getResponseSpy();
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

			sinonAssert.calledOnce(euaService.search);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});
	});

	describe('acceptEua', () => {
		it('accept eua is successful', async () => {
			const req = {
				user: new User({})
			};

			sandbox.stub(euaService, 'acceptEua').resolves(req.user);

			await euaController.acceptEua(req, res);

			sinonAssert.calledOnce(euaService.acceptEua);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			sinonAssert.calledOnce(euaService.publishEua);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			sinonAssert.calledOnce(euaService.create);
			sinonAssert.calledOnce(auditService.audit);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});
	});

	describe('getCurrentEua', () => {
		it('current eua not found', async () => {
			const req = {};
			await euaController.getCurrentEua(req, res);

			sandbox.stub(euaService, 'getCurrentEua').resolves(null);

			await euaController.getCurrentEua(req, res);

			sinonAssert.calledOnce(euaService.getCurrentEua);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});

		it('current eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			sandbox.stub(euaService, 'getCurrentEua').resolves({});

			await euaController.getCurrentEua(req, res);

			sinonAssert.calledOnce(euaService.getCurrentEua);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});
	});

	describe('read', () => {
		it('eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			await euaController.read(req, res);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			sinonAssert.calledOnce(auditService.audit);
			sinonAssert.calledOnce(euaService.update);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
		});
	});

	describe('deleteEua', () => {
		it('eua found', async () => {
			const req = {
				euaParam: new UserAgreement({ _id: '12345' }),
				user: new User({})
			};

			sandbox.stub(auditService, 'audit').resolves();
			sandbox.stub(euaService, 'delete').resolves(req.euaParam);

			await euaController.deleteEua(req, res);

			sinonAssert.calledOnce(auditService.audit);
			sinonAssert.calledOnce(euaService.delete);

			sinonAssert.calledWith(res.status, 200);
			sinonAssert.called(res.json);
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

			assert(req.euaParam);
			sinonAssert.calledWith(nextFn);
		});

		it('eua not found', async () => {
			sandbox.stub(euaService, 'read').resolves();

			const nextFn = stub();
			const req = {} as Request & {
				euaParam: UserAgreementDocument;
			};

			await euaController.euaById(req, {}, nextFn, 'id');

			assert.equal(req.euaParam, undefined);
			sinonAssert.calledWith(
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

				assert.equal(result, test.expected);
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

				await assert.rejects(
					euaController.requiresEua(test.input),
					new ForbiddenError('User must accept end-user agreement.')
				);
			});
		});
	});
});
