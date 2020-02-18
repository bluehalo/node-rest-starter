'use strict';

const
	_ = require('lodash'),
	nodeUtil = require('util'),
	ObjectID = require('mongoose').Types.ObjectId,
	q = require('q'),

	deps = require('../../../dependencies'),
	config = deps.config,
	logger = deps.logger,

	KafkaConsumer = require('../../../lib/kafka-consumer'),
	BaseSocket = require('./base-socket.provider');

// If this is not null, ignore any messages that are older than this number of seconds.
const ignoreOlderThan = config.socketio.ignoreOlderThan;

/**
 * Kafka Socket that has some default consumer message and connection handlers.
 * This is an abstract class and should be overridden by each module that requires it.
 *
 * @abstract
 */
function KafkaSocket(socketConfig, ...args) {
	/**
	 * @type {{string}: {KafkaConsumer}}
	 * Cache of connections by Kafka topics
	 */
	this._connections = {};

	this._emitRateMs = socketConfig.emitRateMs < 0 ? 0 : (+socketConfig.emitRateMs || 0);
	BaseSocket.apply(this, [socketConfig, ...args]);

	// Create a single groupId for each socket that will be shared by all consumers on this websocket
	const socket = this.getSocket();
	socket.kafkaGroupId = socket.kafkaGroupId || `nodejs-${new ObjectID()}`;
}

nodeUtil.inherits(
		KafkaSocket,
		BaseSocket);

KafkaSocket.prototype.name = 'KafkaSocket';

/**
 * Returns the group ID associated with the socket. This can be shared by all consumers registered
 * by the socket, since they will each be listening to different topics.
 *
 * @returns {string}
 */
KafkaSocket.prototype.getGroupId = function() {
	return this.getSocket().kafkaGroupId;
};

/**
 * Handle socket disconnects by unsubscribing from all Kafka topics.
 */
KafkaSocket.prototype.disconnect = function() {
	logger.info('%s: Disconnected from client.', this.name);
	this.unsubscribe(null);
};

/**
 * Handle socket errors by unsubscribing from all Kafka topics.
 */
KafkaSocket.prototype.error = function(err) {
	logger.error(err, '%s: Client connection error', this.name);
	this.unsubscribe(null);
};

/**
 * Returns the name of the socket event that will be transmitted to the client.
 * This should be overridden by each implementing class.
 *
 * @returns {string} The event name to transmit through the socket for each payload.
 */
KafkaSocket.prototype.getEmitType = function() {
	return this._emitType || 'payload';
};

/**
 * Extracts a timestamp from the Kafka payload, which can be used for filtering messages.
 *
 * @param {Object} json The Kafka payload, parsed as JSON.
 * @returns {Number} Returns the timestamp of the payload as a Long.
 */
KafkaSocket.prototype.getMessageTime = function(json) {
	// Default to extracting time from wrapped payload
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
 * Filters a Kafka payload to determine whether it should be transmitted. This should be overridden by the
 * implementing class. It does not need to filter by date, as this is done automatically for all payloads.
 *
 * @param {Object} rawMessage The raw Kafka payload that was received.
 * @param {Object} json The Kafka payload, parsed as JSON.
 * @param {KafkaConsumer} consumer The KafkaConsumer instance that received the message.
 * @return {boolean} False if the payload should be sent to the client, true if it should be ignored.
 */
KafkaSocket.prototype.ignorePayload = function(json, rawMessage, consumer) {
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
 * Default payload handler for Socket-based Kafka listeners. Filters messages by time, then formats
 * and transmits through the socket to the client.
 *
 * @param {KafkaConsumer} consumer The KafkaConsumer instance that received the message.
 * @param {Object} message The raw Kafka payload containing several keys.
 */
KafkaSocket.prototype.kafkaPayloadHandler = function(consumer, message) {
	// Gracefully handle empty messages by ignoring and logging
	if (null == message) {
		logger.warn('%s: Ignoring empty message %s', this.name, message);
		return;
	}

	const self = this;
	logger.debug('%s: Received Kafka Message on topic %s, partition %d, offset %d: %s', this.name, message.topic, message.partition, message.offset, message.value);
	try {
		// Unwrap the payload
		const json = JSON.parse(message.value);
		if (null != json) {

			// Ignore any payloads that don't pass the filter check.
			if (self.ignorePayload(json, message, consumer)) {
				return;
			}

			// The message can be either an object or a promise for an object
			q(json).then((msg) => {
				if (null != msg) {
					self.emitMessage(self.getEmitType(), msg);
				}
			}).fail(function(err) {
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

/**
 * Allows child sockets to customize the way messages are emitted, for instance to provide more advanced throttling.
 * Default implementation emits to the socket as usual.
 *
 * @param {string} emitType The emit type
 * @param {Object} msg The message to emit
 */
KafkaSocket.prototype.emitMessage = function(emitType, msg) {
	this.getSocket().emit(emitType, msg);
};

/**
 * Allows implementing classes to add listeners to a KafkaConsumer whenever it is created.
 *
 * @param {KafkaConsumer} consumer The consumer that was created. You can get the topic from consumer.topic
 */
KafkaSocket.prototype.onNewConsumer = function(consumer) {
	// Handle incoming connections on the consumer

	// Simple throttling is done here, if enabled
	if (this._emitRateMs > 0) {
		consumer.on('message', _.throttle(this.kafkaPayloadHandler, this._emitRateMs).bind(this, consumer));
	} else {
		consumer.on('message', this.kafkaPayloadHandler.bind(this, consumer));
	}
};

/**
 * Returns the consumer that has already been registered on a particular topic.
 *
 * @param {string} topic The topic.
 * @returns {KafkaConsumer|null} The consumer registered for the topic, or null if no consumer has been registered.
 */
KafkaSocket.prototype.getConsumer = function(topic) {
	// Ignore bad input data
	if (null == topic) {
		return null;
	}

	// If our connection cache has a stream to this topic already, return it.
	if (_.has(this._connections, topic)) {
		return this._connections[topic];
	}

	return null;
};

/**
 * Subscribe to a topic.  This creates a new KafkaConsumer for the topic or retrieves an existing one.
 *
 * @param {string} topic The Kafka topic to use for message retrieval.
 * @return {KafkaConsumer} A consumer for the topic.
 */
KafkaSocket.prototype.subscribe = function(topic) {
	// Ignore bad input data
	if (null == topic) {
		return null;
	}

	// If our connection cache has a stream to this topic already, use it. Otherwise, create a new one.
	if (_.has(this._connections, topic)) {
		return this._connections[topic];
	}

	// Create a new consumer for the topic
	const consumer = new KafkaConsumer(topic, this.getGroupId());
	this.onNewConsumer(consumer);

	// Store in internal object cache
	this._connections[topic] = consumer;

	return consumer;
};

/**
 * Unsubscribe from a topic.  If no topic is specified, unsubscribes from all topics consumed by this socket.
*
* @param {string} topic The Kafka topic to unsubscribe from (optional).
*/
KafkaSocket.prototype.unsubscribe = function(topic) {
	const self = this;

	// Unsubscribe from only the specified topic
	if (null != topic) {
		if (null != this._connections[topic]) {
			logger.debug('%s: Closing connection to topic: %s', self.name, topic);
			this._connections[topic].close();
			delete this._connections[topic];
		}
	}
	// Unsubscribe from ALL topics
	else {
		logger.debug('%s: Closing connection to all topics', self.name);
		_.forOwn(this._connections, (connection, topic) => {
			logger.debug('%s: Closing connection to topic: %s', self.name, topic);
			connection.close();
		});
		this._connections = {};
	}
};

module.exports = KafkaSocket;
