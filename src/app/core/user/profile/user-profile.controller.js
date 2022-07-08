'use strict';

const _ = require('lodash'),
	{
		config,
		dbs,
		utilService,
		auditService
	} = require('../../../../dependencies'),
	User = dbs.admin.model('User'),
	userAuthorizationService = require('../auth/user-authorization.service'),
	userService = require('../user.service'),
	userProfileService = require('./user-profile.service'),
	teamService = require('../../teams/teams.service');

/**
 * Standard User Operations
 */

// Get Current User
exports.getCurrentUser = async (req, res) => {
	// The user that is a parameter of the request is stored in 'userParam'
	const user = req.user;

	if (null == user) {
		res.status(400).json({
			message: 'User is not logged in'
		});
		return;
	}

	const userCopy = User.fullCopy(user);

	userAuthorizationService.updateRoles(userCopy);

	await teamService.updateTeams(userCopy);

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
			auditService.audit(
				'user update authentication failed',
				'user',
				'update authentication failed',
				req,
				{}
			);

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
		auditService.audit('user updated', 'user', 'update', req, {
			before: originalUser,
			after: User.auditCopy(user)
		});

		// Log in with the new info
		req.login(user, (error) => {
			if (error) {
				return res.status(400).json(error);
			}
			res.status(200).json(User.fullCopy(user));
		});
	} catch (err) {
		utilService.catchError(res, err);
	}
};

exports.updatePreferences = async (req, res) => {
	await userProfileService.updatePreferences(req.user._id, req.body);
	res.status(200).json({});
};

exports.updateRequiredOrgs = async (req, res) => {
	await userProfileService.updateRequiredOrgs(req.user._id, req.body);
	res.status(200).json({});
};

// Get a filtered version of a user by id
exports.getUserById = (req, res) => {
	res.status(200).json(User.filteredCopy(req.userParam));
};

// Search for users (return filtered version of user)
exports.searchUsers = async (req, res) => {
	// Handle the query/search
	const query = req.body.q;
	const search = req.body.s;

	const results = await userService.searchUsers(req.query, query, search);
	results.elements = results.elements.map(User.filteredCopy);
	res.status(200).json(results);
};

// Match users given a search fragment
exports.matchUsers = async (req, res) => {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const results = await userService.searchUsers(req.query, query, search, [
		'name',
		'username',
		'email'
	]);
	results.elements = results.elements.map(User.filteredCopy);
	res.status(200).json(results);
};

exports.canEditProfile = (authStrategy, user) => {
	return authStrategy !== 'proxy-pki' || user.bypassAccessCheck === true;
};

// Are allowed to edit user profile info
exports.hasEdit = (req) => {
	if (exports.canEditProfile(config.auth.strategy, req.user)) {
		return Promise.resolve();
	}
	return Promise.reject({
		status: 403,
		type: 'not-authorized',
		message: 'User not authorized to edit their profile'
	});
};
