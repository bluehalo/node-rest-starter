'use strict';

const
	path = require('path'),
	swaggerJsDoc = require('swagger-jsdoc'),
	swaggerParser = require('swagger-parser'),

	deps = require('../dependencies'),
	config = deps.config;

/**
 * Unit tests
 */
describe('Init Swagger API:', () => {

	it('Generated Swagger API should be valid', async () => {
		const swaggerOptions = {
			swaggerDefinition: {
				info: {
					title: config.app.title,
					description: config.app.description,
					version: 'test'
				},
				basePath: '/api'
			},
			apis: config.files.routes.map((route) => path.posix.resolve(route))
		};

		if (config.auth.strategy === 'local') {
			swaggerOptions.swaggerDefinition.securityDefinitions = {
				auth: {
					type: 'basic'
				}
			};
		}

		const swaggerSpec = swaggerJsDoc(swaggerOptions);
		await swaggerParser.validate(swaggerSpec);
	});
});
