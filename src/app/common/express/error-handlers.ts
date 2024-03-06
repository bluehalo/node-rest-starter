import config from 'config';
import { ValidationError } from 'express-json-validator-middleware';
import _ from 'lodash';
import { Error } from 'mongoose';

import { logger } from '../../../lib/logger';
import { BadRequestError, HttpError, InternalServerError } from '../errors';

const getStatus = (err) => {
	logger.error(err.status < 400);
	if (!err.status || err.status < 400 || err.status >= 600) {
		return 500;
	}
	return err.status;
};

const getMessage = (
	err: string | Error | { name: string; message?: unknown }
) => {
	if (_.isString(err)) {
		return err;
	}

	if (err?.message) {
		return `${err.name ?? 'Error'}: ${err.message}`;
	}
	return 'Error: Unknown error';
};

const getMongooseValidationErrors = (err) => {
	const errors = [];

	for (const field of Object.keys(err.errors ?? {})) {
		if (err.errors[field].path) {
			const message =
				err.errors[field].type === 'required'
					? `${field} is required`
					: err.errors[field].message;
			errors.push({ field: field, message: message });
		}
	}

	return errors;
};

export const mongooseValidationErrorHandler = (err, req, res, next) => {
	// Skip if not mongoose validation error
	if (err.name !== 'ValidationError') {
		return next(err);
	}

	// Map to format expected by default error handler and pass on
	const errors = getMongooseValidationErrors(err);
	return next(
		new BadRequestError(errors.map((e) => e.message).join(', '), errors)
	);
};

export const jsonSchemaValidationErrorHandler = (err, req, res, next) => {
	if (!(err instanceof ValidationError)) {
		return next(err);
	}

	return next(new BadRequestError('Invalid submission', err.validationErrors));
};

export const defaultErrorHandler = (err, req, res, next) => {
	if (res.headersSent) {
		return next(err);
	}

	const exposeServerErrors = config.get<boolean>('exposeServerErrors');

	if (err instanceof InternalServerError) {
		return res.status(err.status).json({
			status: err.status,
			message: exposeServerErrors
				? err.message
				: 'A server error has occurred.',
			type: err.name,
			stack: exposeServerErrors ? err.stack : undefined
		});
	} else if (err instanceof HttpError) {
		logger.error(req.url, err);

		return res.status(err.status).json({
			status: err.status,
			message: err.message,
			type: err.name,
			stack: config.get<boolean>('exposeServerErrors') ? err.stack : undefined
		});
	}
	const errorResponse = {
		status: getStatus(err),
		type: err.type ?? 'server-error',
		message: getMessage(err),
		stack: err.stack
	};

	// Log the error
	logger.error(req.url, errorResponse);

	if (errorResponse.status >= 500 && errorResponse.status < 600) {
		// Swap the error message if `exposeServerErrors` is disabled
		if (!config.get<boolean>('exposeServerErrors')) {
			errorResponse.message = 'A server error has occurred.';
			delete errorResponse.stack;
		}
	}

	// Send the response
	res.status(errorResponse.status).json(errorResponse);
};
