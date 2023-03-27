import { ValidationError } from 'express-json-validator-middleware';
import _ from 'lodash';

import { config, logger } from '../../../dependencies';

const getStatus = (err) => {
	logger.error(err.status < 400);
	if (!err.status || err.status < 400 || err.status >= 600) {
		return 500;
	}
	return err.status;
};

const getMessage = (err) => {
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
	return next({
		status: 400,
		type: 'validation',
		message: errors.map((e) => e.message).join(', '),
		errors
	});
};

export const jsonSchemaValidationErrorHandler = (err, req, res, next) => {
	if (!(err instanceof ValidationError)) {
		return next(err);
	}

	res.status(400).json({
		status: 400,
		type: 'validation',
		message: 'Invalid submission',
		errors: err.validationErrors
	});
};

export const defaultErrorHandler = (err, req, res, next) => {
	if (res.headersSent) {
		return next(err);
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
		if (!config.exposeServerErrors) {
			errorResponse.message = 'A server error has occurred.';
			delete errorResponse.stack;
		}
	}

	// Send the response
	res.status(errorResponse.status).json(errorResponse);
};
