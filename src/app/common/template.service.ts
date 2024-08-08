import fs from 'fs/promises';

import config from 'config';
import handlebars from 'handlebars';
import _ from 'lodash';

handlebars.registerHelper('not', (value: boolean) => !value);
handlebars.registerHelper(
	'isEqual',
	(value1: unknown, value2: unknown) => value1 === value2
);
handlebars.registerHelper('lower', (str: string) => str?.toLowerCase());
handlebars.registerHelper('upper', (str: string) => str?.toUpperCase());
handlebars.registerHelper(
	'head',
	(str: string, count: number) => str?.substring(0, count)
);
handlebars.registerHelper(
	'tail',
	(str: string, count: number) => str?.substring(str.length - count)
);

class TemplateService {
	async renderTemplate(
		templatePath: string,
		data: Record<string, unknown>,
		options: RuntimeOptions = {}
	) {
		const template = await fs.readFile(templatePath, 'utf-8');
		const templateData = _.merge(
			{},
			{
				app: config.get('app')
			},
			data
		);
		return handlebars.compile(template)(templateData, options);
	}

	renderTemplateStr(
		templateStr: string,
		data: Record<string, unknown>,
		options: RuntimeOptions = {}
	) {
		const templateData = _.merge(
			{},
			{
				app: config.get('app')
			},
			data
		);
		return handlebars.compile(templateStr)(templateData, options);
	}
}

export = new TemplateService();
