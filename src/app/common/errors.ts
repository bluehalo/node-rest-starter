import { StatusCodes } from 'http-status-codes';

export class HttpError extends Error {
	constructor(
		message: string,
		public readonly statusCode: StatusCodes
	) {
		super(message);
		this.name = 'HttpError';
	}

	toJSON(exposeServerErrors = false): Record<string, unknown> {
		return {
			status: this.statusCode,
			message: this.message,
			type: this.name,
			stack: exposeServerErrors ? this.stack : undefined
		};
	}
}

export class BadRequestError extends HttpError {
	constructor(
		message: string,
		public errors?: unknown
	) {
		super(message, StatusCodes.BAD_REQUEST);
		this.name = 'BadRequestError';
	}

	override toJSON(exposeServerErrors = false) {
		const json = super.toJSON(exposeServerErrors);
		json['errors'] = this.errors;
		return json;
	}
}
export class UnauthorizedError extends HttpError {
	constructor(message: string) {
		super(message, StatusCodes.UNAUTHORIZED);
		this.name = 'UnauthorizedError';
	}
}

export class ForbiddenError extends HttpError {
	constructor(message: string) {
		super(message, StatusCodes.FORBIDDEN);
		this.name = 'ForbiddenError';
	}
}

export class NotFoundError extends HttpError {
	constructor(message: string) {
		super(message, StatusCodes.NOT_FOUND);
		this.name = 'NotFoundError';
	}
}

export class InternalServerError extends HttpError {
	constructor(message: string) {
		super(message, StatusCodes.INTERNAL_SERVER_ERROR);
		this.name = 'InternalServerError';
	}

	override toJSON(exposeServerErrors = false) {
		const json = super.toJSON(exposeServerErrors);
		if (exposeServerErrors) {
			json['message'] = 'A server error has occurred.';
		}
		return json;
	}
}
