import _ from 'lodash';

import {
	auditService,
	config,
	logger,
	utilService
} from '../../../../dependencies';
import * as exportConfigController from '../../export/export-config.controller';
import exportConfigService from '../../export/export-config.service';
import userAuthService from '../auth/user-authentication.service';
import userAuthorizationService from '../auth/user-authorization.service';
import userEmailService from '../user-email.service';
import { User, UserDocument } from '../user.model';
import userService from '../user.service';

/**
 * Standard User Operations
 */

export const adminGetUser = (req, res) => {
	// The user that is a parameter of the request is stored in 'userParam'
	const user = req.userParam;

	res.status(200).json(user.fullCopy());
};

export const adminGetAll = async (req, res) => {
	// The field that the admin is requesting is a query parameter
	const field = req.body.field;
	if (null == field || field.length === 0) {
		return res.status(500).json({
			message: 'Query field must be provided'
		});
	}

	const query = req.body.query;

	logger.debug('Querying Users for %s', field);
	const proj = { [field]: 1 };

	const results = await User.find(utilService.toMongoose(query), proj).exec();

	res.status(200).json(
		results.map((r) => {
			return r[field];
		})
	);
};

// Admin Update a User
export const adminUpdateUser = async (req, res) => {
	// The persistence user
	const user: UserDocument = req.userParam;

	// A copy of the original user for auditing
	const originalUser = user.auditCopy();

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

	// Save the user
	await userService.update(user);

	// Audit user update
	auditService.audit('admin user updated', 'user', 'admin update', req, {
		before: originalUser,
		after: user.auditCopy()
	});

	if (config?.coreEmails?.approvedUserEmail?.enabled ?? false) {
		const originalUserRole =
			(originalUser?.roles as Record<string, unknown>)?.user ?? null;
		const newUserRole = user?.roles?.user ?? null;

		if (originalUserRole !== newUserRole && newUserRole) {
			await userEmailService.emailApprovedUser(user, req);
		}
	}

	res.status(200).json(user.fullCopy());
};

// Admin Delete a User
export const adminDeleteUser = async (req, res) => {
	// Init Variables
	const user = req.userParam;

	if (!config?.allowDeleteUser) {
		return res.status(403).json({
			message: 'User deletion is disabled'
		});
	}

	await auditService.audit(
		'admin user deleted',
		'user',
		'admin delete',
		req,
		user.auditCopy()
	);
	await userService.remove(user);
	res.status(200).json(user.fullCopy());
};

// Admin Search for Users
export const adminSearchUsers = async (req, res) => {
	// Handle the query/search/page
	const query = userAuthorizationService.updateUserFilter(req.body.q);
	const search = req.body.s;

	const results = await userService.searchUsers(req.query, query, search, [], {
		path: 'teams.team',
		options: { select: { name: 1 } }
	});
	const mappedResults = {
		pageNumber: results.pageNumber,
		pageSize: results.pageSize,
		totalPages: results.totalPages,
		totalSize: results.totalSize,
		elements: results.elements.map((user) => {
			const userCopy = user.fullCopy();
			userAuthorizationService.updateRoles(userCopy);
			return userCopy;
		})
	};
	res.status(200).json(mappedResults);
};

// GET the requested CSV using a special configuration from the export config collection
export const adminGetCSV = async (req, res) => {
	const exportId = req.params.exportId;

	const result = await exportConfigService.read(exportId);

	if (null == result) {
		return Promise.reject({
			status: 404,
			type: 'bad-argument',
			message: 'Export configuration not found. Document may have expired.'
		});
	}

	auditService.audit(
		`${result.type} CSV config retrieved`,
		'export',
		'export',
		req,
		result.auditCopy()
	);

	const columns = result.config.cols;
	const populate = [];

	// Based on which columns are requested, handle property-specific behavior (ex. callbacks for the
	// CSV service to make booleans and dates more human-readable)
	columns.forEach((col) => {
		switch (col.key) {
			case 'roles.user':
			case 'roles.editor':
			case 'roles.auditor':
			case 'roles.admin':
			case 'bypassAccessCheck':
				col.callback = (value) => {
					return value ? 'true' : '';
				};
				break;
			case 'lastLogin':
			case 'created':
			case 'updated':
			case 'acceptedEua':
				col.callback = (value: unknown) => {
					return _.isDate(value) ? value.toISOString() : '';
				};
				break;
			case 'teams':
				populate.push({ path: 'teams._id', select: 'name' });
				col.callback = (value: unknown) => {
					return (value as Array<{ _id: { name: string } }>)
						.map((team) => team._id.name)
						.join(', ');
				};
				break;
		}
	});

	const query = result.config.q ? JSON.parse(result.config.q) : null;
	const search = result.config.s;
	const fileName = `${config.app.instanceName}-${result.type}.csv`;

	const userCursor = userService.cursorSearch(
		result.config,
		search,
		query,
		populate
	);

	exportConfigController.exportCSV(req, res, fileName, columns, userCursor);
};

// Admin creates a user
async function _adminCreateUser(user, req, res) {
	// Initialize the user
	const result = await userAuthService.initializeNewUser(user);
	await result.save();

	auditService.audit(
		'admin user create',
		'user',
		'admin user create',
		req,
		result.auditCopy()
	);
	res.status(200).json(result.fullCopy());
}

/**
 * Admin Create a User (Local Strategy)
 */
export const adminCreateUser = async (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.bypassAccessCheck = req.body.bypassAccessCheck;
	user.roles = req.body.roles;
	user.provider = 'local';

	// Need to set null passwords to empty string for mongoose validation to work
	if (null == user.password) {
		user.password = '';
	}

	await _adminCreateUser(user, req, res);
};

/**
 * Admin Create a User (Pki Strategy)
 */
export const adminCreateUserPki = async (req, res) => {
	const user = new User(User.createCopy(req.body));
	user.bypassAccessCheck = req.body.bypassAccessCheck;
	user.roles = req.body.roles;

	if (null != req.body.username) {
		user.username = req.body.username;
		user.providerData = {
			dn: req.body.username,
			dnLower: req.body.username.toLowerCase()
		};
	}
	user.provider = 'pki';

	await _adminCreateUser(user, req, res);
};
