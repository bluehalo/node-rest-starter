'use strict';

const
	events = require('events'),
	kafka = require('kafka-node'),
	q = require('q'),
	util = require('util'),

	config = require('../config'),
	logger = require('./bunyan').logger;

/**
 * Generate a random group id so all of our listeners go into different consumer pools.
 *
 * @param topic
 * @returns {string}
 */
function createGroupId(topic) {
	return `nodejs-${topic}-${Math.random()}`;
}

/**
 * Gets a new Kafka ConsumerGroup.  We need to do this for each new connection, according to Kafka best practices.
 *
 * @returns A promise to return a ConsumerGroup.
 */
function getConsumer(topic, groupId, extraOptions) {

	// Default options
	let options = {
		fromOffset: 'latest',
		outOfRangeOffset: 'latest'
	};

	// If extraOptions are provided merge with default Options
	if (null != extraOptions) {
		options = Object.assign(options, extraOptions);
	}

	const connectionOptions = {
		host: config.kafka.zookeeper,
		groupId: groupId
	};

	// Merge connectionOptions
	options = Object.assign(options, connectionOptions);

	const consumer = new kafka.ConsumerGroup(options, topic);

	return q.resolve(consumer);
}

function disconnect(connection) {
	if (connection.state === 'connected') {

		connection.state = 'closing';
		connection.getConsumer()
			.then((consumer) => {
				if (null != consumer) {
					try {
						consumer.close();
					}
					catch (err) {
						// Ignore, since we're closing the connection anyway
					}
				}
				connection.emit('disconnect');
			})
			.fail((err) => {
				logger.error(err, 'Kafka Consumer: error closing consumer');

				// Re-emit this error to listeners.
				connection.emit('error', err);
			})
			.done();
	}
}

/**
 * Creates a new set of environment state for a particular connection.  This connection will automatically
 * reconnect itself if there are errors.
 *
 * @param {string} topic The topic to connection to.
 * @param {string=} groupId Optionally, a groupId to use for this connection.
 * @param {boolean=} currentOffset Optionally, use the current offset in zookeeper, otherwise use latest offset [default].
 */
function KafkaConsumer(topic, groupId, currentOffset, extraOptions) {
	this.topic = topic;

	// The state: disconnected, connecting, connected, reconnecting, closing
	this.state = 'disconnected';

	// The deferred promise to get a consumer connection
	this.deferred = null;

	// If the consumer is reconnecting, this is a reference to the timeout
	this.timeout = null;

	// A groupId for this consumer.  If this connection is reconnected, the same groupId will be used.
	this.groupId = groupId;

	// This will be set to true once we've initialized the offsets for this groupId.
	this.offsetsInitialized = (currentOffset === true);

	// Any extraOptions we want to provide to kafka-node consumer
	this.extraOptions = extraOptions;

	// This class is an EventEmitter
	events.EventEmitter.call(this);

	// Listen to our own error event, to avoid throwing exceptions out to NodeJS
	this.on('error', (err) => {
		// Ignore, this error will already have been logged elsewhere
	});

	// Immediately initiate a request to connect
	this.getConsumer();
}
util.inherits(KafkaConsumer, events.EventEmitter);

/**
 * @type {number} The number of milliseconds to wait before reconnecting.  This can be overridden for each connection,
 *   or in the prototype for all connections, or in the config.
 */
KafkaConsumer.prototype.retryMs = (null != config.kafka && null != config.kafka.kafkaRetryMs) ? config.kafka.kafkaRetryMs : 3000;

/**
 * @type {number} The Kafka partition from which to get the offset.  This defaults to 0.
 */
KafkaConsumer.prototype.partition = 0;

KafkaConsumer.prototype.isPending = function() {
	return null != this.deferred && this.deferred.promise.isPending();
};

/**
 * Connect a consumer to the given topic.  If an active consumer already exists, it will be immediately
 * returned; otherwise a new consumer will be created.
 *
 * @param topic The topic to connect to.
 * @returns A promise to return a KafkaConsumer.
 */
KafkaConsumer.prototype.getConsumer = function() {
	const self = this;

	// Initialize the deferred promise, if we don't already have one.
	self.deferred = self.deferred || q.defer();

	// If we are closing the connection, make sure the promise is actually resolved
	if (self.state === 'closing' && self.deferred.promise.isPending()) {
		self.deferred.resolve(null);
	}

	// Unless we are disconnected, simply return the existing promise.
	if (self.state !== 'disconnected') {
		return self.deferred.promise;
	}

	// At this point, we know we are in the disconnected state.  Try initiating a connection.

	self.state = 'connecting';
	self.groupId = self.groupId || createGroupId(self.topic);

	// Try to connect, creating a new consumer each time.
	getConsumer(self.topic, self.groupId, self.extraOptions).then((consumer) => {
		// If the connection was closed in the meantime, it's possible the deferred object has been cleared.
		// If so, we don't care about the response.
		if (null != self.deferred) {
			self.state = 'connected';

			// Since each consumer has its own group Id, the offsets by default will reset to the beginning
			// of the topic since the group hasn't consumed anything yet.  Instead, we want to start at
			// the end of the topic, but do it in a partition-agnostic way.
			if (!self.offsetsInitialized) {

				// Pause the consumer until we've got the correct offsets.
				consumer.pause();

				// Replace the default rebalance event listeners with our own
				const rebalanceListeners = consumer.listeners('rebalanced');
				consumer.removeAllListeners('rebalanced');

				// The first time the consumer is rebalanced, get the offsets
				consumer.once('rebalanced', () => {
					// Get the last offset for each topic
					const payloads = consumer.getTopicPayloads().map((topic) => {
						return {
							topic: topic.topic,
							partition: Number(topic.partition),
							time: -1, // Specify -1 to receive the latest offsets
							maxNum: 1 // The number of values to retrieve
						};
					});

					consumer.offsetRequest(payloads, (err, offsets) => {
						if (err) {
							consumer.emit('error', err);
						}
						else {

							// Condense multiple offset values
							for (const topic in offsets) {
								for (const partition in offsets[topic]) {
									offsets[topic][partition] = Math.min.apply(null, offsets[topic][partition]);
									logger.info(`Kafka Consumer: Connected to topic ${topic}, partition: ${partition}, offset: ${offsets[topic][partition]}`);
								}
							}

							// Update the offsets and commit them
							consumer.updateOffsets(offsets, true);
							consumer.commit(false, (err) => {
								if (err) {
									consumer.emit('error', err);
								}
								else {
									self.offsetsInitialized = true;

									// Re-register the previous listeners
									rebalanceListeners.forEach((listener) => {
										consumer.on('rebalanced', listener);
									});

									// The consumer is now ready to start reading from the topic
									consumer.ready = true;
									consumer.resume();
								}
							});
						}
					});
				});
			}

			// If the consumer receives an error, try to reconnect
			consumer.on('error', (err) => {

				// If the promise still hasn't been resolved, we need to reject it
				// before we create a new one; otherwise clients listening to the old
				// promise could hang forever.
				if (self.isPending()) {
					self.deferred.reject(err);
				}

				// We only need to handle this error if we are actually connected.
				// Otherwise, we are probably trying to close the connection.
				if (self.state === 'connected') {
					if (err.name === 'TopicsNotExistError') {
						logger.warn(`Kafka Consumer: ${err.message}`);
					}
					else {
						logger.error(err, 'Kafka Consumer: Connection to zookeeper failed.');
					}

					// Re-emit this to error to listeners.
					self.emit('error', err);

					// Try to reconnect
					self.reconnect();
				}
			});

			// If the consumer receives a message, re-emit to our own event handler.
			// This allows consumers to bind to the KafkaConsumer object rather than to a Consumer
			// that may need to reconnect.
			consumer.on('message', (message) => {
				// Re-emit the message to listeners of this wrapper
				self.emit('message', message);
			});

			// Notify listeners that a connection was made.
			self.emit('connect');

			// Resolve the deferred promise with the consumer.  The next time getConsumer() is called,
			// the consumer will immediately be returned.
			self.deferred.resolve(consumer);
		}
	}).fail((err) => {
		logger.error(err, 'Kafka Consumer: error creating consumer');

		// Re-emit this error to listeners.
		self.emit('error', err);

		// There was some sort of error creating the connection, so reject the connection promise.
		// It's possible that at this point the state was lost, so check for nulls first.
		if (self.isPending()) {
			self.deferred.reject(err);
		}

		// Then try connecting again, which should create a new promise.
		self.reconnect();
	}).done();

	return self.deferred.promise;
};

/**
 * Disconnects this consumer from its topic, closing all necessary resources and canceling any pending reconnects.
 */
KafkaConsumer.prototype.close = function() {
	logger.info(`Kafka Consumer: Disconnecting zookeeper topic ${this.topic}`);

	// Explicitly close the connection (but only do this if we were actually connected)
	disconnect(this);

	this.state = 'disconnected';

	if (this.isPending()) {
		this.deferred.reject();
	}
	this.deferred = null;

	// If there is a reconnect timeout, cancel it
	if (null != this.timeout) {
		clearTimeout(this.timeout);
		this.timeout = null;
	}
};

/**
 * Reconnects to the given topic after a delay.
 *
 * @param topic The topic to reconnect to.
 */
KafkaConsumer.prototype.reconnect = function() {
	const self = this;

	// If a reconnection is already scheduled, don't do it again.
	if (null == self.timeout) {
		logger.info(`Kafka Consumer: Attempting to reconnect zookeeper topic ${self.topic} in ${self.retryMs} ms`);

		// Let listeners know we are reconnecting.  They will subsequently also get 'disconnect' and 'connect' notifications.
		self.emit('reconnect');

		// Create a new deferred promise.  Subsequent calls to connect will get this promise even before the
		// reconnection has occurred.
		// Explicitly close the connection (but only do this if we were actually connected)
		disconnect(self);

		self.state = 'reconnecting';

		if (self.isPending()) {
			self.deferred.reject();
		}
		self.deferred = q.defer();

		// Setup a timeout
		self.timeout = setTimeout(() => {
			self.timeout = null;
			self.state = 'disconnected';

			// Trigger the connection to be recreated.  This will also fulfill the promise returned from the
			// reconnect() function.
			self.getConsumer();
		}, self.retryMs);
	}
	return self.deferred.promise;
};

// Export API
module.exports = KafkaConsumer;
