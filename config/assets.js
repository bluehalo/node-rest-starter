'use strict';

module.exports = {

	// Test specific source files
	tests: [ 'test-server.js', 'src/server/**/*.spec.js' ],
	e2e: [ 'e2e/**/*.spec.js' ],

	models: [ 'src/**/*.model!(.spec).js' ],
	routes: [ 'src/**/*.routes!(.spec).js' ],
	sockets: [ 'src/**/*.socket!(.spec).js' ],
	config: [ 'src/**/*.config!(.spec).js' ]
};
