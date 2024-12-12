import _ from 'lodash';
import { Socket } from 'socket.io';

import { BaseSocket, SocketConfig } from './base-socket.provider';
import { getEventEmitter } from '../event/event-emitter.service';

export default abstract class EventSocket extends BaseSocket {
	_emitterFunc: (message: Record<string, unknown>) => void;

	protected constructor(_socket: Socket, socketConfig: SocketConfig = {}) {
		super(_socket, socketConfig);
	}

	/**
	 * Subscribe to an event.
	 *
	 * @return null if topic is not set, true if successful
	 */
	subscribe(topic: string) {
		// Ignore bad input data
		if (null == topic) {
			return null;
		}

		// Simple throttling is done here, if enabled

		if (this._emitRateMs > 0) {
			this._emitterFunc = _.throttle(
				this.payloadHandler,
				this._emitRateMs
			).bind(this, topic);
		} else {
			this._emitterFunc = this.payloadHandler.bind(this, topic);
		}
		getEventEmitter().on(topic, this._emitterFunc);
		return true;
	}

	/**
	 * Unsubscribe from a topic.  If no topic is specified, unsubscribes from all topics consumed by this socket.
	 *
	 * @param {string} topic The topic to unsubscribe from (optional).
	 */
	unsubscribe(topic: string) {
		if (typeof this._emitterFunc === 'function') {
			getEventEmitter().removeListener(topic, this._emitterFunc);
		}
	}
}
