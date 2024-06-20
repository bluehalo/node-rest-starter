import path from 'path';

import { globSync } from 'glob';
import { OpenAPI } from 'openapi-types';
import swaggerJsDoc from 'swagger-jsdoc';
import SwaggerParser from 'swagger-parser';

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
					title: config.get<string>('app.title'),
					description: config.get<string>('app.description'),
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
				...globSync(config.get<string[]>('assets.docs')).map((doc: string) =>
					path.posix.resolve(doc)
				),
				...globSync(config.get<string[]>('assets.routes')).map(
					(route: string) => path.posix.resolve(route)
				),
				...globSync(config.get<string[]>('assets.models')).map(
					(model: string) => path.posix.resolve(model)
				)
			]
		};

		if (config.get<string>('auth.strategy') === 'local') {
			swaggerOptions.swaggerDefinition.components.securitySchemes = {
				basicAuth: {
					type: 'http',
					scheme: 'basic'
				}
			};
		}

		const swaggerSpec = swaggerJsDoc(swaggerOptions) as OpenAPI.Document;
		// @ts-expect-error tsc:watch reports type error, but code runs properly.  SwaggerParser is defined as both a class and namespace.
		await SwaggerParser.validate(swaggerSpec);
	});
});
