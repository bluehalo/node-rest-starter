import os from 'os';
import path from 'path';

import config from 'config';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, errors, json, splat, timestamp } = winston.format;

function createLogger(loggerName: string) {
	const loggerConfig = config.get('logger').get(loggerName);

	const options = {
		format: combine(timestamp(), errors({ stack: true }), splat(), json()),
		silent: loggerConfig.get('silent'),
		defaultMeta: {
			hostname: os.hostname(),
			name: config.app.instanceName,
			pid: process.pid
		},
		transports: []
	};

	const consoleConfig = loggerConfig.get('console');
	if (consoleConfig.get('enabled')) {
		options.transports.push(
			new winston.transports.Console({
				level: consoleConfig.get('level')
			})
		);
	}

	const fileConfig = loggerConfig.get('file');
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

	return winston.createLogger(options);
}

export const logger = createLogger('application');

export const auditLogger = createLogger('audit');

export const metricsLogger = createLogger('metrics');
