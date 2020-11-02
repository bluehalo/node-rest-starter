'use strict';

const
	should = require('should'),
	sinon = require('sinon'),
	mongoose = require('mongoose'),

	deps = require('../../../../dependencies'),

	userAuthorizationService = require('./user-authorization.service');

describe('User authorization service:', () => {

	let sandbox;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('validateAccessToPersonalResource', () => {
		const id1 = mongoose.Types.ObjectId();
		const id2 = mongoose.Types.ObjectId();

		it('test user (not admin) access own resource', () => {
			const user = {roles: {admin: false}, _id: id1};
			const resource = {creator: id1};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});

		it('test user (not admin) access another user resource', () => {
			const user = {roles: {admin: false}, _id: id1};
			const resource = {creator: id2};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.rejected();
		});

		it('test user with no roles access own resource', () => {
			const user = { _id: id1};
			const resource = {creator: id1};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});

		it('test user with no roles access another user resource', () => {
			const user = {_id: id1};
			const resource = {creator: id2};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.rejected();
		});

		it('test admin access own resource', () => {
			const user = {roles: {admin: true}, _id: id1};
			const resource = {creator: id1};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});

		it('test admin access another user resource', () => {
			const user = {roles: {admin: true}, _id: id1};
			const resource = {creator: id2};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});
	});

	describe('updateRoles', () => {
		it('roleStrategy === local; should pass through roles as is', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('local');
			sandbox.stub(deps.config.auth, 'roles').value(['user', 'elevatedRole1', 'elevatedRole2']);

			const user = {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				}
			};

			userAuthorizationService.updateRoles(user);

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.elevatedRole1.should.be.true();
			user.roles.elevatedRole2.should.be.false();

			should.not.exist(user.localRoles);
		});

		it('roleStrategy === external; should pass through roles as is', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('external');
			sandbox.stub(deps.config.auth, 'roles').value(['user', 'elevatedRole1', 'elevatedRole2', 'admin']);
			sandbox.stub(deps.config.auth, 'externalRoles').value({
				provider: {
					file: 'src/app/core/user/auth/external-role-map.provider.js',
					config: {
						externalRoleMap: {
							user: 'USER',
							elevatedRole1: 'ELEVATED_ROLE_1',
							elevatedRole2: 'ELEVATED_ROLE_2',
							admin: 'ADMIN'
						}
					}
				}
			});

			const user = {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				},
				externalRoles: ['USER', 'ELEVATED_ROLE_2']
			};

			userAuthorizationService.updateRoles(user);

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.elevatedRole1.should.be.false();
			user.roles.elevatedRole2.should.be.true();

			should.not.exist(user.localRoles);
		});

		it('roleStrategy === hybrid; should pass through roles as is', () => {
			sandbox.stub(deps.config.auth, 'roleStrategy').value('hybrid');
			sandbox.stub(deps.config.auth, 'roles').value(['user', 'elevatedRole1', 'elevatedRole2', 'admin']);
			sandbox.stub(deps.config.auth, 'externalRoles').value({
				provider: {
					file: 'src/app/core/user/auth/external-role-map.provider.js',
					config: {
						externalRoleMap: {
							user: 'USER',
							elevatedRole1: 'ELEVATED_ROLE_1',
							elevatedRole2: 'ELEVATED_ROLE_2',
							admin: 'ADMIN'
						}
					}
				}
			});

			const user = {
				roles: {
					user: true,
					elevatedRole1: true,
					elevatedRole2: false
				},
				externalRoles: ['USER', 'ELEVATED_ROLE_2']
			};

			userAuthorizationService.updateRoles(user);

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.elevatedRole1.should.be.true();
			user.roles.elevatedRole2.should.be.true();
			user.roles.admin.should.be.false();

			user.localRoles.should.be.an.Object();
			user.localRoles.user.should.be.true();
			user.localRoles.elevatedRole1.should.be.true();
			user.localRoles.elevatedRole2.should.be.false();
		});
	});

});
