import * as async from 'async';
import config from 'config';
import { Request, RequestHandler, Response } from 'express';
import { Socket } from 'socket.io';

import { logger } from '../../../dependencies';

// If this is not null, ignore any messages that are older than this number of seconds.
const ignoreOlderThan = config.get<number>('socketio.ignoreOlderThan');

export type SocketConfig = {
	emitName?: string;
	emitRateMs?: number;
};

export abstract class BaseSocket<MessageType = Record<string, unknown>> {
	_userId?: string;
	_emitName: string;
	_emitRateMs: number;

	protected constructor(
		protected socket: Socket,
		_config: SocketConfig
	) {
		this._emitName = _config.emitName;
		this._emitRateMs = Math.max(_config.emitRateMs ?? 0, 0);

		this.socket.on('disconnect', this.onDisconnect.bind(this));
		this.socket.on('error', this.onError.bind(this));
		this.socket.on(`${this._emitName}:subscribe`, this.onSubscribe.bind(this));
		// Set up Unsubscribe events
		this.socket.on(
			`${this._emitName}:unsubscribe`,
			this.onUnsubscribe.bind(this)
		);
	}

	abstract onDisconnect();

	abstract onError(err);

	abstract onSubscribe(message: MessageType);

	abstract onUnsubscribe(message: MessageType);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	subscribe(topic: string) {
		throw new Error(
			'subscribe not implemented.  BaseSocket should not be instantiated directly.'
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	unsubscribe(topic: string) {
		throw new Error(
			'unsubscribe not implemented.  BaseSocket should not be instantiated directly.'
		);
	}

	getMessagePayload(
		topic: string,
		message: MessageType
	): Record<string, unknown> {
		logger.debug(
			'%s: Received Event Message for event %s',
			this.constructor.name,
			topic
		);
		return message as Record<string, unknown>;
	}

	/**
	 * Allows child sockets to customize the way messages are emitted, for instance to provide more advanced throttling.
	 * Default implementation emits to the socket as usual.
	 *
	 * @param emitType The emit type
	 * @param msg The message to emit
	 */
	emitMessage(emitType: string, msg: unknown) {
		this.socket.emit(emitType, msg);
	}

	/**
	 * Extracts a timestamp from the payload, which can be used for filtering messages.
	 *
	 * @param messagePayload The payload, parsed as JSON.
	 * @returns Returns the timestamp of the payload as a Long.
	 */
	getMessageTime(messagePayload: Record<string, unknown>) {
		// Default to extracting time from payload
		if (messagePayload?.time) {
			const time = messagePayload.time;
			logger.debug(
				'%s: Extracted message time of %d',
				this.constructor.name,
				time
			);
			return time as number;
		}

		if (logger.debug()) {
			// is debug enabled?
			logger.debug(
				'%s: Unknown time for message: %s',
				this.constructor.name,
				JSON.stringify(messagePayload)
			);
		}

		return null;
	}

	/**
	 * Filters a payload to determine whether it should be transmitted. This should be overridden by the
	 * implementing class. It does not need to filter by date, as this is done automatically for all payloads.
	 *
	 * @param {Object} messagePayload The payload, parsed as JSON.
	 * @return {boolean} False if the payload should be sent to the client, true if it should be ignored.
	 */
	ignorePayload(message: MessageType, messagePayload: Record<string, unknown>) {
		// Ignore any payloads that are too old.
		if (null != ignoreOlderThan) {
			const messageTime = this.getMessageTime(messagePayload);
			if (null != messageTime) {
				const now = Date.now();
				if (messageTime + ignoreOlderThan * 1000 < now) {
					logger.debug(
						'%s: Message is too old: %d is more than %d seconds older than %d',
						this.constructor.name,
						messageTime,
						ignoreOlderThan,
						now
					);
					return true;
				}
			}
		}
		return false;
	}

	payloadHandler(topic: string, message: MessageType) {
		// Gracefully handle empty messages by ignoring and logging
		if (null == message) {
			logger.warn(
				'%s: Ignoring empty message %s',
				this.constructor.name,
				message
			);
			return;
		}

		try {
			const messagePayload = this.getMessagePayload(topic, message);
			if (messagePayload) {
				// Ignore any payloads that don't pass the filter check.
				if (this.ignorePayload(message, messagePayload)) {
					return;
				}
				// Create a payload to send back to the client, containing the message and metadata identifying
				// which stream it pertains to for routing on the client side.
				const msg = this.getEmitMessage(message);

				// The message can be either an object or a promise for an object
				if (null != msg) {
					this.emitMessage(this.getEmitType(), msg);
				}
			}
		} catch (e) {
			logger.error(
				{ err: e, msg: message },
				'%s: Error parsing payload body.',
				this.constructor.name
			);
		}
	}

	/**
	 * Returns the name of the socket event that will be transmitted to the client.
	 * This should be overridden by each implementing class.
	 *
	 * @returns The event name to transmit through the socket for each payload.
	 */
	getEmitType() {
		return this._emitName ? `${this._emitName}:data` : 'payload';
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	getEmitMessageKey(message: MessageType) {
		return null;
	}

	getEmitMessage(message: MessageType) {
		const key = this.getEmitMessageKey(message);
		if (key) {
			return {
				key,
				value: message
			};
		}
		return message;
	}

	getUserId() {
		if (null == this._userId) {
			const user = this.socket.request?.['user'] ?? null;
			if (user !== null) {
				// Store this for the next request, since it won't change for this socket.
				this._userId = user.id;
			}
		}
		return this._userId;
	}

	/**
	 * Gets a placeholder request object for the open socket.
	 *
	 * @returns An object that looks like an HTTP request.  It will contain the user object from the
	 *   actual socket request.
	 */
	getRequest() {
		const req = this.socket.request as unknown as {
			user: unknown;
			isAuthenticated: () => void;
			isUnauthenticated: () => void;
		};
		return {
			user: req.user,
			isAuthenticated: () => req.isAuthenticated(),
			isUnauthenticated: () => req.isUnauthenticated()
		} as Request;
	}

	/**
	 * Gets a placeholder response object that can be used for middleware.  It stubs out the status() and send()
	 * methods, and if there is an error, forwards it to the next handler.
	 *
	 * @param next A callback for the async handler.  It will be called with an error if the middleware
	 *   callback function passes any message to the UI.
	 */
	getResponse(next: (err?: unknown) => void) {
		function send(data) {
			const err = new Error(data?.message ?? 'Unauthorized');
			return next(err);
		}

		function status() {
			return {
				send: send,
				json: send
			};
		}

		return {
			status,
			send,
			json: send
		} as unknown as Response;
	}

	/**
	 * Applies a set of callbacks in series.  Each function should accept a request and response object and
	 * a callback function, in the same format as the Express.js middleware.
	 *
	 * @param callbacks - An array of middleware callbacks to execute.
	 * @param [done] - Optionally, a function that will be called when all middleware has processed, either
	 *   with an error or without.
	 *
	 * @returns A promise that will be resolved when all the middleware has run.  You can either
	 *   listen for this or pass in a callback.
	 */
	applyMiddleware(
		callbacks: Array<RequestHandler>,
		done?: (err, result) => void
	): Promise<void> {
		return new Promise((resolve, reject) => {
			// Use the same request for all callbacks
			const req = this.getRequest();

			const tasks = callbacks.map((callback) => {
				return (next) => {
					// Create a new response for each next() callback
					const res = this.getResponse(next);

					// Invoke the callback
					callback(req, res, next);
				};
			});
			async.series(tasks, (err, results) => {
				// Get the result from the last task
				const result = results[tasks.length - 1];

				// Invoke the callback if there is one
				if (null != done) {
					done(err, result);
				}

				// In addition to the optional callback,
				// resolve or reject the promise
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
	}
}

export type BaseSocketSubclass = (new (
	socket: Socket,
	config: SocketConfig
) => BaseSocket) & {
	// a concrete constructor of BaseClass<any>
	[K in keyof typeof BaseSocket]: (typeof BaseSocket)[K];
};
