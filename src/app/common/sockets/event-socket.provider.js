'use strict';

const
	_ = require('lodash'),
	nodeUtil = require('util'),

	deps = require('../../../dependencies'),
	config = deps.config,
	logger = deps.logger,

	// Default event handler
	eventEmitter = require('../event/event-emitter.service'),
	BaseSocket = require('./base-socket.provider');

// If this is not null, ignore any messages that are older than this number of seconds.
const ignoreOlderThan = config.socketio.ignoreOlderThan;

function EventSocket(socketConfig, ...args) {
	this._emitRateMs = socketConfig.emitRateMs < 0 ? 0 : (+socketConfig.emitRateMs || 0);
	BaseSocket.apply(this, [socketConfig, ...args]);
}

nodeUtil.inherits(
	EventSocket,
	BaseSocket);

EventSocket.prototype.name = 'EventSocket';

/**
 * Handle socket disconnects by unsubscribing from events.
 */
EventSocket.prototype.disconnect = function() {
	logger.info('%s: Disconnected from client.', this.name);
	this.unsubscribe(null);
};

/**
 * Handle socket errors by unsubscribing from events.
 */
EventSocket.prototype.error = function(err) {
	logger.error(err, '%s: Client connection error', this.name);
	this.unsubscribe(null);
};

/**
 * Returns the name of the socket event that will be transmitted to the client.
 * This should be overridden by each implementing class.
 *
 * @returns {string} The event name to transmit through the socket for each payload.
 */
EventSocket.prototype.getEmitType = function() {
	return this._emitType || 'payload';
};

/**
 * Extracts a timestamp from the payload, which can be used for filtering messages.
 *
 * @param {Object} json The payload, parsed as JSON.
 * @returns {Number} Returns the timestamp of the payload as a Long.
 */
EventSocket.prototype.getMessageTime = function(json) {
	// Default to extracting time from json
	if (null != json) {
		const time = json.time;
		logger.debug('%s: Extracted message time of %d', this.name, time);
		return time;
	}

	if (logger.debug()) { // is debug enabled?
		logger.debug('%s: Unknown time for message: %s', this.name, JSON.stringify(json));
	}

	return null;
};

/**
 * Filters a payload to determine whether it should be transmitted. This should be overridden by the
 * implementing class. It does not need to filter by date, as this is done automatically for all payloads.
 *
 * @param {Object} json The payload, parsed as JSON.
 * @return {boolean} False if the payload should be sent to the client, true if it should be ignored.
 */
EventSocket.prototype.ignorePayload = function(json) {
	// Ignore any payloads that are too old.
	if (null != ignoreOlderThan) {
		const now = Date.now();
		const messageTime = this.getMessageTime(json);
		if (null != messageTime) {
			if (messageTime + (ignoreOlderThan * 1000) < now) {
				logger.debug('%s: Message is too old: %d is more than %d seconds older than %d', this.name, messageTime, ignoreOlderThan, now);
				return true;
			}
		}
	}
	return false;
};

/**
 * Allows child sockets to customize the way messages are emitted, for instance to provide more advanced throttling.
 * Default implementation emits to the socket as usual.
 *
 * @param {string} emitType The emit type
 * @param {Object} msg The message to emit
 */
EventSocket.prototype.emitMessage = function(emitType, msg) {
	this.getSocket().emit(emitType, msg);
};

/**
 * Subscribe to an event.
 *
 * @return null if eventName is not set, true if successful
 */
EventSocket.prototype.subscribe = function(eventName) {
	// Ignore bad input data
	if (null == eventName) {
		return null;
	}

	// Simple throttling is done here, if enabled

	if (this._emitRateMs > 0) {
		this.emitterFunc = _.throttle(this.socketPayloadHandler, this._emitRateMs).bind(this, eventName);
	} else {
		this.emitterFunc = this.socketPayloadHandler.bind(this, eventName);
	}
	eventEmitter.getEventEmitter().on(eventName, this.emitterFunc);
};

/**
 * Unsubscribe from a topic.  If no topic is specified, unsubscribes from all topics consumed by this socket.
 *
 * @param {string} topic The topic to unsubscribe from (optional).
 */
EventSocket.prototype.unsubscribe = function(eventName) {
	if (typeof this.emitterFunc === 'function') {
		eventEmitter.getEventEmitter().removeListener(eventName, this.emitterFunc);
	}
};

EventSocket.prototype.socketPayloadHandler = function(eventName, message) {
	// Gracefully handle empty messages by ignoring and logging
	if (null == message) {
		logger.warn('%s: Ignoring empty message %s', this.name, message);
		return;
	}

	const self = this;
	logger.debug('%s: Received Event Message for event %s', this.name, eventName);
	try {
		// Unwrap the payload
		if (null != message) {

			// Ignore any payloads that don't pass the filter check.
			if (self.ignorePayload(message)) {
				return;
			}

			// The message can be either an object or a promise for an object
			Promise.all([message]).then(([msg]) => {
				if (null != msg) {
					self.emitMessage(self.getEmitType(), msg);
				}
			}).catch(function(err) {
				if (logger.debug()) {
					logger.debug('Ignoring payload for user %s: %s', this.getUserId(), err);
				}
			});
		}
	}
	catch (e) {
		logger.error({err: e, msg: message.value }, '%s: Error parsing payload body.', this.name);
	}
};

module.exports = EventSocket;
