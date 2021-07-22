'use strict';

const _ = require('lodash'),
	deps = require('../../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	util = deps.utilService,
	logger = deps.logger,
	auditService = deps.auditService,
	TeamMember = dbs.admin.model('TeamUser'),
	User = dbs.admin.model('User'),
	resourcesService = require('../../resources/resources.service'),
	userAuthorizationService = require('../auth/user-authorization.service'),
	userService = require('../user.service'),
	userEmailService = require('../user-email.service');

/**
 * Standard User Operations
 */

exports.adminGetUser = (req, res) => {
	// The user that is a parameter of the request is stored in 'userParam'
	const user = req.userParam;

	res.status(200).json(User.fullCopy(user));
};

exports.adminGetAll = async (req, res) => {
	// The field that the admin is requesting is a query parameter
	const field = req.body.field;
	if (null == field || field.length === 0) {
		return res.status(500).json({
			message: 'Query field must be provided'
		});
	}

	const query = req.body.query;

	logger.debug('Querying Users for %s', field);
	const proj = {};
	proj[field] = 1;

	try {
		const results = await User.find(util.toMongoose(query), proj).exec();

		res.status(200).json(
			results.map((r) => {
				return r[field];
			})
		);
	} catch (error) {
		return util.handleErrorResponse(res, error);
	}
};

// Admin Update a User
exports.adminUpdateUser = async (req, res) => {
	// The persistence user
	const user = req.userParam;

	// A copy of the original user for auditing
	const originalUser = User.auditCopy(user);

	// Copy over the new user properties
	user.name = req.body.name;
	user.organization = req.body.organization;
	user.email = req.body.email;
	user.phone = req.body.phone;
	user.username = req.body.username;
	user.roles = req.body.roles;
	user.bypassAccessCheck = req.body.bypassAccessCheck;

	if (_.isString(req.body.password) && !_.isEmpty(req.body.password)) {
		user.password = req.body.password;
	}

	try {
		// Save the user
		await userService.update(user);

		// Audit user update
		auditService.audit(
			'admin user updated',
			'user',
			'admin update',
			TeamMember.auditCopy(
				req.user,
				util.getHeaderField(req.headers, 'x-real-ip')
			),
			{
				before: originalUser,
				after: User.auditCopy(user)
			},
			req.headers
		);

		if (config?.coreEmails?.approvedUserEmail?.enabled ?? false) {
			const originalUserRole = originalUser?.roles?.user ?? null;
			const newUserRole = user?.roles?.user ?? null;

			if (originalUserRole !== newUserRole && newUserRole) {
				await userEmailService.emailApprovedUser(user);
			}
		}

		res.status(200).json(User.fullCopy(user));
	} catch (error) {
		return util.handleErrorResponse(res, error);
	}
};

// Admin Delete a User
exports.adminDeleteUser = async (req, res) => {
	// Init Variables
	const user = req.userParam;

	try {
		await auditService.audit(
			'admin user deleted',
			'user',
			'admin delete',
			TeamMember.auditCopy(
				req.user,
				util.getHeaderField(req.headers, 'x-real-ip')
			),
			User.auditCopy(user),
			req.headers
		);
		await resourcesService.deleteResourcesWithOwner(user._id, 'user');
		await userService.remove(user);
		res.status(200).json(User.fullCopy(user));
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

// Admin Search for Users
exports.adminSearchUsers = async (req, res) => {
	// Handle the query/search/page
	const query = userAuthorizationService.updateUserFilter(req.body.q);
	const search = req.body.s;

	try {
		const results = await userService.searchUsers(req.query, query, search);
		results.elements = results.elements.map((user) => {
			const userCopy = User.fullCopy(user);
			userAuthorizationService.updateRoles(userCopy);
			return userCopy;
		});
		res.status(200).json(results);
	} catch (error) {
		return util.handleErrorResponse(res, error);
	}
};
