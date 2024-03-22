import config from 'config';
import { ErrorRequestHandler } from 'express';
import { ValidationError } from 'express-json-validator-middleware';
import _ from 'lodash';
import { Error as MongooseError } from 'mongoose';

import { logger } from '../../../lib/logger';
import { BadRequestError, HttpError } from '../errors';

export const mongooseValidationErrorHandler: ErrorRequestHandler = (
	err,
	req,
	res,
	next
) => {
	// Skip if not mongoose validation error
	if (!(err instanceof MongooseError.ValidationError)) {
		return next(err);
	}

	// Map to format expected by default error handler and pass on
	const errors = Object.entries(err.errors ?? {})
		.filter(
			([, innerError]) => innerError instanceof MongooseError.ValidatorError
		)
		.map(([field, innerError]) => ({ field, message: innerError.message }));

	return next(
		new BadRequestError(errors.map((e) => e.message).join(', '), errors)
	);
};

export const jsonSchemaValidationErrorHandler: ErrorRequestHandler = (
	err: Error,
	req,
	res,
	next
) => {
	// Skip if not json schema validation error
	if (!(err instanceof ValidationError)) {
		return next(err);
	}

	return next(
		new BadRequestError('Schema validation error', err.validationErrors)
	);
};

export const defaultErrorHandler: ErrorRequestHandler = (
	err,
	req,
	res,
	next
) => {
	if (res.headersSent) {
		return next(err);
	}

	const exposeServerErrors = config.get<boolean>('exposeServerErrors');

	if (err instanceof HttpError) {
		logger.error(req.url, err);

		return res.status(err.status).json(err.toJSON(exposeServerErrors));
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
		if (!exposeServerErrors) {
			errorResponse.message = 'A server error has occurred.';
			delete errorResponse.stack;
		}
	}

	// Send the response
	res.status(errorResponse.status).json(errorResponse);
};

const getStatus = (err: Parameters<ErrorRequestHandler>[0]) => {
	if (!err.status || err.status < 400 || err.status >= 600) {
		return 500;
	}
	return err.status;
};

const getMessage = (err: Parameters<ErrorRequestHandler>[0]) => {
	if (_.isString(err)) {
		return err;
	}

	if (err?.message) {
		return `${err.name ?? 'Error'}: ${err.message}`;
	}

	return 'Error: Unknown error';
};
