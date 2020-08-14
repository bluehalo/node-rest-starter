'use strict';

const
	_ = require('lodash'),

	deps = require('../../../../dependencies'),
	config = deps.config,
	dbs = deps.dbs,
	util = deps.utilService,
	auditService = deps.auditService,

	TeamMember = dbs.admin.model('TeamUser'),
	User = dbs.admin.model('User'),

	userAuthorizationService = require('../auth/user-authorization.service'),
	userService = require('../user.service'),
	userProfileService = require('./user-profile.service');

/**
 * Standard User Operations
 */

// Get Current User
exports.getCurrentUser = (req, res) => {

	// The user that is a parameter of the request is stored in 'userParam'
	const user = req.user;

	if (null == user){
		res.status(400).json({
			message: 'User is not logged in'
		});
		return;
	}

	const userCopy = User.fullCopy(user);

	userAuthorizationService.updateRoles(userCopy, config.auth);

	res.status(200).json(userCopy);
};

// Update Current User
exports.updateCurrentUser = async (req, res) => {
	// Make sure the user is logged in
	if (null == req.user) {
		return res.status(400).json({
			message: 'User is not logged in'
		});
	}

	// Get the full user (including the password)
	const user = await User.findById(req.user._id).exec();
	const originalUser = User.auditCopy(user);

	// Copy over the new user properties
	user.name = req.body.name;
	user.organization = req.body.organization;
	user.email = req.body.email;
	user.phone = req.body.phone;
	user.username = req.body.username;
	user.messagesAcknowledged = req.body.messagesAcknowledged;
	user.alertsViewed = req.body.alertsViewed;
	user.openSidebar = req.body.openSidebar;
	user.newFeatureDismissed = req.body.newFeatureDismissed;

	// Update the updated date
	user.updated = Date.now();

	// If they are changing the password, verify the current password
	if (_.isString(req.body.password) && !_.isEmpty(req.body.password)) {
		if (!user.authenticate(req.body.currentPassword)) {

			// Audit failed authentication
			auditService.audit('user update authentication failed', 'user', 'update authentication failed', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), {}, req.headers);

			res.status(400).json({
				message: 'Current password invalid'
			});
			return;
		}

		// We passed the auth check and we're updating the password
		user.password = req.body.password;
	}

	// Save the user
	try {
		await user.save();

		// Remove the password/salt
		delete user.password;
		delete user.salt;

		// Audit user update
		auditService.audit('user updated', 'user', 'update', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), {
			before: originalUser,
			after: User.auditCopy(user)
		}, req.headers);

		// Log in with the new info
		req.login(user, (error) => {
			if (error) {
				return res.status(400).json(error);
			}
			res.status(200).json(User.fullCopy(user));
		});
	} catch (err) {
		util.catchError(res, err);
	}
};

exports.updatePreferences = async (req, res) => {
	try {
		await userProfileService.updatePreferences(req.user._id, req.body);
		res.status(200).json({});
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

exports.updateRequiredOrgs = async (req, res) => {
	try {
		await userProfileService.updateRequiredOrgs(req.user._id, req.body);
		res.status(200).json({});
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

// Get a filtered version of a user by id
exports.getUserById = (req, res) => {

	// The user that is a parameter of the request is stored in 'userParam'
	const user = req.userParam;

	if (null == user){
		res.status(400).json({
			message: 'User does not exist'
		});
		return;
	}

	res.status(200).json(User.filteredCopy(user));
};

// Search for users (return filtered version of user)
exports.searchUsers = async (req, res) => {
	// Handle the query/search
	const query = req.body.q;
	const search = req.body.s;

	try {
		const results = await userService.searchUsers(req.query, query, search);
		results.elements = results.elements.map(User.filteredCopy);
		res.status(200).json(results);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

// Match users given a search fragment
exports.matchUsers = async (req, res) => {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	try {
		const results = await userService.searchUsers(req.query, query, search, ['name', 'username', 'email']);
		results.elements = results.elements.map(User.filteredCopy);
		res.status(200).json(results);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

exports.canEditProfile = (authStrategy, user) => {
	return authStrategy !== 'proxy-pki' || user.bypassAccessCheck === true;
};

// Are allowed to edit user profile info
exports.hasEdit = (req) => {
	if (exports.canEditProfile(config.auth.strategy, req.user)) {
		return Promise.resolve();
	}
	return Promise.reject({ status: 403, type: 'not-authorized', message: 'User not authorized to edit their profile' });
};
