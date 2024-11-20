import os from 'os';
import path from 'path';

import config, { IConfig } from 'config';
import winston, { LoggerOptions } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, errors, json, splat, timestamp, prettyPrint } = winston.format;

function createLogger(loggerName: string) {
	const loggerConfig = config.get<IConfig>('logger').get<IConfig>(loggerName);

	const prettyPrintEnabled = loggerConfig.get<boolean>('prettyPrint');

	const format = prettyPrintEnabled
		? combine(
				timestamp(),
				errors({ stack: true }),
				splat(),
				json(),
				prettyPrint()
		  )
		: combine(timestamp(), errors({ stack: true }), splat(), json());

	const options = {
		format,
		silent: loggerConfig.get('silent'),
		defaultMeta: {
			hostname: os.hostname(),
			name: config.get('app.instanceName'),
			pid: process.pid
		},
		transports: []
	};

	const consoleConfig = loggerConfig.get<IConfig>('console');
	if (consoleConfig.get('enabled')) {
		options.transports.push(
			new winston.transports.Console({
				level: consoleConfig.get('level')
			})
		);
	}

	const fileConfig = loggerConfig.get<IConfig>('file');
	if (fileConfig.get('enabled')) {
		options.transports.push(
			new DailyRotateFile({
				level: fileConfig.get('level'),
				filename: `${fileConfig.get('directory') || '.'}${
					path.sep
				}${fileConfig.get('filename')}`,
				datePattern: fileConfig.get('datePattern'),
				zippedArchive: fileConfig.get('zippedArchive'),
				maxSize: fileConfig.get('maxSize'),
				maxFiles: fileConfig.get('maxFiles')
			})
		);
	}

	return winston.createLogger(options as LoggerOptions);
}

export const logger = createLogger('application');

export const auditLogger = createLogger('audit');

export const metricsLogger = createLogger('metrics');
