import { Socket } from 'socket.io';

import { config, socketIO } from '../../../dependencies';
import { logger } from '../../../lib/logger';
import { SocketConfig } from '../../common/sockets/base-socket.provider';
import { requireAccess } from '../user/auth/auth.hooks';

const emitName = 'alert';

/**
 * NotificationSocket Socket Controller that overrides Base Socket Controller
 * methods to handle specifics of Notifications
 */
export class NotificationSocket extends socketIO.SocketProvider {
	_topicName = config.get<string>('notifications.topic');
	_subscriptionCount = 0;

	constructor(socket: Socket, _config: SocketConfig) {
		super(socket, { ..._config, emitName });
	}

	ignorePayload(json: { user: { toString: () => string } }) {
		// Ignore any payloads that do not match the current user.
		return (
			!json ||
			!json.user ||
			json.user.toString() !== this.getUserId().toString()
		);
	}

	/**
	 * Returns the topic
	 */
	getTopic() {
		return this._topicName;
	}

	/**
	 * Handle socket disconnects
	 */
	onDisconnect() {
		logger.info('NotificationSocket: Disconnected from client.');

		this.unsubscribe(this.getTopic());
	}

	/**
	 * Handle socket errors
	 */
	onError(err: unknown) {
		logger.error('NotificationSocket: Client connection error', { err });

		this.unsubscribe(this.getTopic());
	}

	/**
	 *
	 */
	onSubscribe(payload: unknown) {
		if (logger.isDebugEnabled()) {
			logger.debug(
				`NotificationSocket: ${emitName}:subscribe event with payload: ${JSON.stringify(
					payload
				)}`
			);
		}

		// Check that the user account has access
		requireAccess(this.getRequest(), null)
			.then(() => {
				// Subscribe to the user's notification topic
				const topic = this.getTopic();
				this.subscribe(topic);
				this._subscriptionCount++;
			})
			.catch((err) => {
				logger.warn(
					`Unauthorized access to notifications by inactive user ${this.getUserId()}: ${err}`
				);
			});
	}

	/**
	 *
	 */
	onUnsubscribe(payload: unknown) {
		if (logger.isDebugEnabled()) {
			logger.debug(
				`NotificationSocket: ${emitName}:unsubscribe event with payload: ${JSON.stringify(
					payload
				)}`
			);
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

if (config.get<boolean>('notifications.enabled')) {
	socketIO.registerSocketListener(NotificationSocket);
}

module.exports = NotificationSocket;
