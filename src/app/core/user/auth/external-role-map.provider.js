'use strict';

module.exports = function(config) {
	return {
		hasRole: (user, role) => {
			const externalRoles = user.externalRoles || [];
			return externalRoles.indexOf(config.externalRoleMap[role]) !== -1;
		},

		generateFilterForRole: (role) => {
			return { externalRoles: config.externalRoleMap[role] };
		}
	};
};
