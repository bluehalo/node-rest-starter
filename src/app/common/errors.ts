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
}

export class BadRequestError extends HttpError {
	constructor(
		message: string,
		public errors?: unknown
	) {
		super(StatusCodes.BAD_REQUEST, 'BadRequestError', message);
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
}
