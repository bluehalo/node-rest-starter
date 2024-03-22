import { StatusCodes } from 'http-status-codes';

export class BaseError extends Error {
	constructor(name: string, message: string) {
		super(message);
		this.name = name;
	}
}
export class HttpError extends BaseError {
	constructor(
		public readonly status: StatusCodes,
		name: string,
		message: string
	) {
		super(name, message);
	}

	toJSON(exposeServerErrors = false): Record<string, unknown> {
		return {
			status: this.status,
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
		super(StatusCodes.BAD_REQUEST, 'BadRequestError', message);
	}

	override toJSON(exposeServerErrors = false) {
		const json = super.toJSON(exposeServerErrors);
		json['errors'] = this.errors;
		return json;
	}
}
export class UnauthorizedError extends HttpError {
	constructor(message: string) {
		super(StatusCodes.UNAUTHORIZED, 'UnauthorizedError', message);
	}
}

export class ForbiddenError extends HttpError {
	constructor(message: string) {
		super(StatusCodes.FORBIDDEN, 'ForbiddenError', message);
	}
}

export class NotFoundError extends HttpError {
	constructor(message: string) {
		super(StatusCodes.NOT_FOUND, 'NotFoundError', message);
	}
}

export class InternalServerError extends HttpError {
	constructor(message: string) {
		super(StatusCodes.INTERNAL_SERVER_ERROR, 'InternalServerError', message);
	}

	override toJSON(exposeServerErrors = false) {
		const json = super.toJSON(exposeServerErrors);
		if (exposeServerErrors) {
			json['message'] = 'A server error has occurred.';
		}
		return json;
	}
}
