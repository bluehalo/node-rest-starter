'use strict';

const deps = require('../../../../dependencies'),
	logger = deps.logger,
	preferenceService = require('./preference.service');

/**
 * Clean up orphaned preferences (referenced user no longer exists)
 * @returns {Promise<void>}
 *
 */
module.exports.run = async () => {
	const preferences = await preferenceService.searchAll({}, [
		{ path: 'user', select: ['_id'] }
	]);

	await Promise.all(
		preferences
			.filter((preference) => !preference.user)
			.map((preference) => {
				// depopulate to get access to the nonexistent user id for logging
				preference.depopulate('user');
				logger.debug(
					`Removing preference=${preference._id} owned by nonexistent user=${preference.user}`
				);
				return preference.remove();
			})
	);
};
