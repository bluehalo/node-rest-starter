import { Router } from 'express';

import * as userAdminController from './user-admin.controller';
import { config } from '../../../../dependencies';
import { exportConfigById } from '../../export/export-config.controller';
import { hasAdminAccess } from '../user-auth.middleware';
import * as users from '../user.controller';

const router = Router();

/**
 * Admin User Routes (require admin)
 */

// Admin search users
router
	.route('/admin/users')
	.post(hasAdminAccess, userAdminController.adminSearchUsers);

// Admin retrieve/update/delete
router
	.route('/admin/user/:userId')
	.get(hasAdminAccess, userAdminController.adminGetUser)
	.post(hasAdminAccess, userAdminController.adminUpdateUser)
	.delete(hasAdminAccess, userAdminController.adminDeleteUser);

// Get user CSV using the specifies config id
router
	.route('/admin/users/csv/:exportId')
	.get(hasAdminAccess, userAdminController.adminGetCSV);

// Admin retrieving a User field for all users in the system
router
	.route('/admin/users/getAll')
	.post(hasAdminAccess, userAdminController.adminGetAll);

/**
 * Routes that only apply to the 'local' passport strategy
 */
if (config.get('auth.strategy') === 'local') {
	// Admin Create User
	router
		.route('/admin/user')
		.post(hasAdminAccess, userAdminController.adminCreateUser);
} else if (config.get('auth.strategy') === 'proxy-pki') {
	// Admin Create User
	router
		.route('/admin/user')
		.post(hasAdminAccess, userAdminController.adminCreateUserPki);
}

// Finish by binding the user middleware
router.param('userId', users.userById);

router.param('exportId', exportConfigById);

export = router;
