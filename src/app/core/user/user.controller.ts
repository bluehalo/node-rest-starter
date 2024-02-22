import { StatusCodes } from 'http-status-codes';
import _ from 'lodash';

import userAuthorizationService from './auth/user-authorization.service';
import userService from './user.service';
import { auditService, config } from '../../../dependencies';
import {
	BadRequestError,
	ForbiddenError,
	UnauthorizedError
} from '../../common/errors';
import teamService from '../teams/teams.service';

/**
 * Standard User Operations
 */

// Get Current User
export const getCurrentUser = async (req, res) => {
	// The user that is a parameter of the request is stored in 'userParam'
	const user = req.user;

	if (null == user) {
		throw new UnauthorizedError('User is not logged in');
	}

	const userCopy = user.fullCopy();

	userAuthorizationService.updateRoles(userCopy);

	await teamService.updateTeams(userCopy);

	res.status(StatusCodes.OK).json(userCopy);
};

// Update Current User
export const updateCurrentUser = async (req, res) => {
	// Make sure the user is logged in
	if (null == req.user) {
		throw new BadRequestError('User is not logged in');
	}

	// Get the full user (including the password)
	const user = await userService.read(req.user._id);
	const originalUser = user.auditCopy();

	// Copy over the new user properties
	user.name = req.body.name;
	user.organization = req.body.organization;
	user.email = req.body.email;
	user.phone = req.body.phone;
	user.username = req.body.username;
	user.messagesAcknowledged = req.body.messagesAcknowledged;
	user.alertsViewed = req.body.alertsViewed;
	user.newFeatureDismissed = req.body.newFeatureDismissed;

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

			throw new BadRequestError('Current password invalid');
		}

		// We passed the auth check and we're updating the password
		user.password = req.body.password;
	}

	// Save the user
	await user.save();

	// Remove the password/salt
	delete user.password;
	delete user.salt;

	// Audit user update
	auditService.audit('user updated', 'user', 'update', req, {
		before: originalUser,
		after: user.auditCopy()
	});

	// Log in with the new info
	req.login(user, (error) => {
		if (error) {
			return res.status(StatusCodes.BAD_REQUEST).json(error);
		}
		res.status(StatusCodes.OK).json(user.fullCopy());
	});
};

export const updatePreferences = async (req, res) => {
	await userService.updatePreferences(req.user, req.body);
	res.status(StatusCodes.OK).json({});
};

export const updateRequiredOrgs = async (req, res) => {
	await userService.updateRequiredOrgs(req.user, req.body);
	res.status(StatusCodes.OK).json({});
};

// Get a filtered version of a user by id
export const getUserById = (req, res) => {
	res.status(StatusCodes.OK).json(req.userParam.filteredCopy());
};

// Search for users (return filtered version of user)
export const searchUsers = async (req, res) => {
	// Handle the query/search
	const query = req.body.q;
	const search = req.body.s;

	const results = await userService.searchUsers(req.query, query, search);
	const mappedResults = {
		pageSize: results.pageSize,
		pageNumber: results.pageNumber,
		totalSize: results.totalSize,
		totalPages: results.totalPages,
		elements: results.elements.map((user) => user.filteredCopy())
	};
	res.status(StatusCodes.OK).json(mappedResults);
};

// Match users given a search fragment
export const matchUsers = async (req, res) => {
	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	const results = await userService.searchUsers(req.query, query, search, [
		'name',
		'username',
		'email'
	]);
	const mappedResults = {
		pageSize: results.pageSize,
		pageNumber: results.pageNumber,
		totalSize: results.totalSize,
		totalPages: results.totalPages,
		elements: results.elements.map((user) => user.filteredCopy())
	};
	res.status(StatusCodes.OK).json(mappedResults);
};

export const canEditProfile = (authStrategy, user) => {
	return authStrategy !== 'proxy-pki' || user.bypassAccessCheck === true;
};

// Are allowed to edit user profile info
export const hasEdit = (req) => {
	if (canEditProfile(config.auth.strategy, req.user)) {
		return Promise.resolve();
	}
	return Promise.reject(
		new ForbiddenError('User not authorized to edit their profile')
	);
};

// User middleware - stores user corresponding to id in 'userParam'
export const userById = async (req, res, next, id) => {
	const user = await userService.read(id);
	if (!user) {
		return next(new Error(`Failed to load User ${id}`));
	}
	req.userParam = user;
	return next();
};
