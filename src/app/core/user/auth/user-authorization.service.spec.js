'use strict';

const
	should = require('should'),
	mongoose = require('mongoose'),

	userAuthorizationService = require('./user-authorization.service');

describe('User authorization service:', () => {

	describe('validateAccessToPersonalResource', () => {
		let id1 = mongoose.Types.ObjectId();
		let id2 = mongoose.Types.ObjectId();

		it('test user (not admin) access own resource', () => {
			let user = {roles: {admin: false}, _id: id1};
			let resource = {creator: id1};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});

		it('test user (not admin) access another user resource', () => {
			let user = {roles: {admin: false}, _id: id1};
			let resource = {creator: id2};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.rejected();
		});

		it('test user with no roles access own resource', () => {
			let user = { _id: id1};
			let resource = {creator: id1};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});

		it('test user with no roles access another user resource', () => {
			let user = {_id: id1};
			let resource = {creator: id2};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.rejected();
		});

		it('test admin access own resource', () => {
			let user = {roles: {admin: true}, _id: id1};
			let resource = {creator: id1};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});

		it('test admin access another user resource', () => {
			let user = {roles: {admin: true}, _id: id1};
			let resource = {creator: id2};

			return userAuthorizationService.validateAccessToPersonalResource(user, resource).should.be.fulfilled();
		});
	});

	describe('updateRoles', () => {
		it('roleStrategy === local; should pass through roles as is', () => {
			let user = {
				roles: {
					user: true,
					contentSteward: true,
					equipmentSteward: false
				}
			};

			userAuthorizationService.updateRoles(user, {
				roleStrategy: 'local'
			});

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.contentSteward.should.be.true();
			user.roles.equipmentSteward.should.be.false();

			should.not.exist(user.localRoles);
		});

		it('roleStrategy === external; should pass through roles as is', () => {
			let user = {
				roles: {
					user: true,
					contentSteward: true,
					equipmentSteward: false
				},
				externalRoles: ['USER', 'EQUIPMENT_STEWARD']
			};

			userAuthorizationService.updateRoles(user, {
				roleStrategy: 'external',
				externalRoleMap: {
					user: 'USER',
					contentSteward: 'CONTENT_STEWARD',
					equipmentSteward: 'EQUIPMENT_STEWARD',
					admin: 'ADMIN'
				}
			});

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.contentSteward.should.be.false();
			user.roles.equipmentSteward.should.be.true();

			should.not.exist(user.localRoles);
		});

		it('roleStrategy === hybrid; should pass through roles as is', () => {
			let user = {
				roles: {
					user: true,
					contentSteward: true,
					equipmentSteward: false
				},
				externalRoles: ['USER', 'EQUIPMENT_STEWARD']
			};

			userAuthorizationService.updateRoles(user, {
				roleStrategy: 'hybrid',
				externalRoleMap: {
					user: 'USER',
					contentSteward: 'CONTENT_STEWARD',
					equipmentSteward: 'EQUIPMENT_STEWARD',
					admin: 'ADMIN'
				}
			});

			user.should.be.an.Object();
			user.roles.should.be.an.Object();
			user.roles.user.should.be.true();
			user.roles.contentSteward.should.be.true();
			user.roles.equipmentSteward.should.be.true();
			user.roles.admin.should.be.false();

			user.localRoles.should.be.an.Object();
			user.localRoles.user.should.be.true();
			user.localRoles.contentSteward.should.be.true();
			user.localRoles.equipmentSteward.should.be.false();
		});
	});

});
