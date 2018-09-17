'use strict';

const q = require('q');


// Simple example provider that simply returns the user if they exist in the config
module.exports = function(config) {
	return {
		get: function(id) {
			return q(config[id]);
		}
	};
};
