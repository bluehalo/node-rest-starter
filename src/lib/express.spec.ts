import path from 'path';

import { globSync } from 'glob';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerParser from 'swagger-parser';

import { config } from '../dependencies';

/**
 * Unit tests
 */
describe('Init Swagger API:', () => {
	it('Generated Swagger API should be valid', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
				...globSync(config.assets.docs).map((doc: string) =>
					path.posix.resolve(doc)
				),
				...globSync(config.assets.routes).map((route: string) =>
					path.posix.resolve(route)
				),
				...globSync(config.assets.models).map((model: string) =>
					path.posix.resolve(model)
				)
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
