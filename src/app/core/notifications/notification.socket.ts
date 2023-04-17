import _ from 'lodash';
import { Socket } from 'socket.io';

import { config, logger, socketIO } from '../../../dependencies';
import { SocketConfig } from '../../common/sockets/base-socket.provider';
import { hasAccess } from '../user/user-auth.middleware';

const emitName = 'alert';

/**
 * NotificationSocket Socket Controller that overrides Base Socket Controller
 * methods to handle specifics of Notifications
 */
export class NotificationSocket extends socketIO.SocketProvider {
	_topicName = config.dispatcher ? config.dispatcher.notificationTopic : '';
	_subscriptionCount = 0;

	constructor(socket: Socket, _config: SocketConfig) {
		super(socket, { ..._config, emitName });
	}

	ignorePayload(json) {
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
	onError(err) {
		logger.error(err, 'NotificationSocket: Client connection error');

		this.unsubscribe(this.getTopic());
	}

	/**
	 *
	 */
	onSubscribe(payload) {
		if (logger.debug()) {
			logger.debug(
				`NotificationSocket: ${emitName}:subscribe event with payload: ${JSON.stringify(
					payload
				)}`
			);
		}

		// Check that the user account has access
		this.applyMiddleware([hasAccess])
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
	onUnsubscribe(payload) {
		if (logger.debug()) {
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

if (
	config.dispatcher &&
	(!_.has(config.dispatcher, 'enabled') || config.dispatcher.enabled)
) {
	socketIO.registerSocketListener(NotificationSocket);
}

module.exports = NotificationSocket;
