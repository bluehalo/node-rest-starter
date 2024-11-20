import { Socket } from 'socket.io';

import { config, socketIO } from '../../../dependencies';
import { logger } from '../../../lib/logger';
import { SocketConfig } from '../../common/sockets/base-socket.provider';
import { requireAccess } from '../user/auth/auth.middleware';

const emitName = 'message';

/**
 * MessageSocket Socket Controller that overrides Base Socket Controller
 * methods to handle specifics of Messages
 */
export class MessageSocket extends socketIO.SocketProvider {
	_topicName = config.get<string>('messages.topic');
	_subscriptionCount = 0;

	constructor(socket: Socket, _config: SocketConfig) {
		super(socket, { ..._config, emitName });
	}

	/**
	 * Returns the topic for a user ID.
	 */
	getTopic() {
		return this._topicName;
	}

	/**
	 * Handle socket disconnects
	 */
	override onDisconnect() {
		logger.info('MessageSocket: Disconnected from client.');

		this.unsubscribe(this.getTopic());
	}

	/**
	 * Handle socket errors
	 */
	override onError(err: Error) {
		logger.error('MessageSocket: Client connection error', err);

		this.unsubscribe(this.getTopic());
	}

	/**
	 *
	 */
	onSubscribe(payload: unknown) {
		if (logger.isDebugEnabled()) {
			logger.debug(`MessageSocket: ${emitName}: subscribe event`, { payload });
		}

		// Check that the user account has access
		requireAccess(this.getRequest(), null)
			.then(() => {
				// Subscribe to the user's message topic
				const topic = this.getTopic();
				this.subscribe(topic);
				this._subscriptionCount++;
			})
			.catch((err) => {
				logger.warn('Unauthorized access to messages by inactive user', {
					user: this.getUserId(),
					err
				});
			});
	}

	/**
	 *
	 */
	onUnsubscribe(payload: unknown) {
		if (logger.isDebugEnabled()) {
			logger.debug(`MessageSocket: ${emitName}: unsubscribe event`, {
				payload
			});
		}

		const topic = this.getTopic();
		this.unsubscribe(topic);

		this._subscriptionCount = Math.max(0, this._subscriptionCount - 1);
		// If we are no longer listening for anything, unsubscribe
		if (this._subscriptionCount === 0) {
			this.unsubscribe(this.getTopic());
		}
	}
}

socketIO.registerSocketListener(MessageSocket);
