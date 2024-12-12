import config from 'config';
import { FastifyRequest } from 'fastify';
import { Socket } from 'socket.io';

import { logger } from '../../../lib/logger';

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

	abstract onDisconnect(): void;

	abstract onError(err: Error): void;

	abstract onSubscribe(message: MessageType): void;

	abstract onUnsubscribe(message: MessageType): void;

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
			`${this.constructor.name}: Received Event Message for event ${topic}`
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
				`${this.constructor.name}: Extracted message time of ${time}`
			);
			return time as number;
		}

		if (logger.isDebugEnabled()) {
			// is debug enabled?
			logger.debug(
				`${this.constructor.name}: Unknown time for message: ${JSON.stringify(
					messagePayload
				)}`
			);
		}

		return null;
	}

	/**
	 * Filters a payload to determine whether it should be transmitted. This should be overridden by the
	 * implementing class. It does not need to filter by date, as this is done automatically for all payloads.
	 *
	 * @param message
	 * @param messagePayload The payload, parsed as JSON.
	 * @return False if the payload should be sent to the client, true if it should be ignored.
	 */
	ignorePayload(message: MessageType, messagePayload: Record<string, unknown>) {
		// Ignore any payloads that are too old.
		if (null != ignoreOlderThan) {
			const messageTime = this.getMessageTime(messagePayload);
			if (null != messageTime) {
				const now = Date.now();
				if (messageTime + ignoreOlderThan * 1000 < now) {
					logger.debug(
						`${this.constructor.name}: Message is too old: ${messageTime} is more than ${ignoreOlderThan} seconds older than ${now}`
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
				`${this.constructor.name}: Ignoring empty message ${message}`
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
			logger.error(`${this.constructor.name}: Error parsing payload body.`, {
				err: e,
				msg: message
			});
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
	getEmitMessageKey(message: MessageType): string | null {
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
			const user = (
				this.socket.request as unknown as { user?: { _id: string } }
			).user;
			if (user) {
				// Store this for the next request, since it won't change for this socket.
				this._userId = user._id.toString();
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
		} as FastifyRequest;
	}
}

export type BaseSocketSubclass = (new (
	socket: Socket,
	config: SocketConfig
) => BaseSocket) & {
	// a concrete constructor of BaseClass<any>
	[K in keyof typeof BaseSocket]: (typeof BaseSocket)[K];
};
