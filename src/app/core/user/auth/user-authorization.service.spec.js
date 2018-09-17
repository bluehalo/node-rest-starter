'use strict';

const
	should = require('should'),
	mongoose = require('mongoose'),

	userAuthorizationService = require('./user-authorization.service');

describe('User authorization service:', () => {

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
