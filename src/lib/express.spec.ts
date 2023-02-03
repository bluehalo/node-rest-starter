import path from 'path';

import swaggerJsDoc from 'swagger-jsdoc';
import swaggerParser from 'swagger-parser';

import { config } from '../dependencies';

/**
 * Unit tests
 */
describe('Init Swagger API:', () => {
	it('Generated Swagger API should be valid', async () => {
		const swaggerOptions: any = {
			swaggerDefinition: {
				openapi: '3.0.2',
				info: {
					title: config.app.title,
					description: config.app.description,
					version: 'test'
				},
				servers: [
					{
						url: 'https://api.example.com/api'
					}
				],
				components: {}
			},
			apis: [
				...config.files.docs.map((doc) => path.posix.resolve(doc)),
				...config.files.routes.map((route) => path.posix.resolve(route)),
				...config.files.models.map((model) => path.posix.resolve(model))
			]
		};

		if (config.auth.strategy === 'local') {
			swaggerOptions.swaggerDefinition.components.securitySchemes = {
				basicAuth: {
					type: 'http',
					scheme: 'basic'
				}
			};
		}

		const swaggerSpec = swaggerJsDoc(swaggerOptions);
		await swaggerParser.validate(swaggerSpec);
	});
});
