'use strict';

module.exports = {
	// Test specific source files
	tests: ['src/**/*.spec.js', 'src/**/*.spec.ts'],
	e2e: ['e2e/**/*.spec.js'],

	models: ['src/**/*.model!(.spec).{js,ts}'],
	routes: ['src/**/*.routes!(.spec).{js,ts}'],
	sockets: ['src/**/*.socket!(.spec).{js,ts}'],
	config: ['src/**/*.config!(.spec).js'],
	docs: ['src/**/*/*.components.yml']
};
