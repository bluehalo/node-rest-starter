'use strict';

// Simple example provider that simply returns the user if they exist in the config
module.exports = function(config) {
	return {
		get: function(id) {
			throw new Error('Stuffs broke.');
		}
	};
};
