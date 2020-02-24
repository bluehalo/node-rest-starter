'use strict';

const
	events = require('events'),
	kafka = require('kafka-node'),
	HighLevelProducer = kafka.HighLevelProducer,
	q = require('q'),

	config = require('../config'),
	logger = require('./bunyan').logger;

let _producerPromise = null;
const _events = new events.EventEmitter();

let _timeout = null;
let _retryPayloads = [];
let _retryPromises = [];
let _retryPromise = null;
let _connectTimeout = null;

/**
 * @type {number} The number of milliseconds to wait before attempting to send any queued payloads.
 *   This can be changed in the config.
 */
const retryMs = (null != config.kafka && null != config.kafka.kafkaRetryMs) ? config.kafka.kafkaRetryMs : 3000;

/**
 * @type {number} The number of milliseconds to wait before deciding that Zookeeper is unreachable.
 *   This can be changed in the config.
 */
const zookeeperCommTimeout = (null != config.kafka && null != config.kafka.zookeeperCommTimeout) ? config.kafka.zookeeperCommTimeout : 1000;

// Listen to our own error event so we don't crash the app.
_events.on('error', () => {});

/**
 * Returns the active producer, creating a new one if necessary.
 *
 * @returns {Promise{HighLevelProducer}} A promise for the producer singleton.
 */
const getProducer = () => {
	if (null != _producerPromise) {
		return _producerPromise.promise;
	}

	let client, producer = null;
	_producerPromise = q.defer();

	// Get the promise to return at this point, just in case onError is called before we have a chance to return it
	const promise = _producerPromise.promise;

	function onError(err) {
		logger.error(err, 'Kafka Producer: Failed to send payload');
		_events.emit('error', err);

		// The producer remembers the error, so we'll need to close it, reject the promise and create a
		// new one next time we retry.
		if (null != producer) {
			producer.close();
		}
		_producerPromise.reject(err);
		_producerPromise = null;
	}

	try {
		// Create the client and the producer
		client = new kafka.Client(config.kafka.zookeeper);
		producer = new HighLevelProducer(client);

		// When the producer is ready, resolve the promise.
		// This will always be called even if there is an error, unless Zookeeper is down.
		producer.once('ready', () => {
			if (null != _connectTimeout) {
				clearTimeout(_connectTimeout);
				_connectTimeout = null;
			}
			_events.emit('connect', producer);
			if (null != _producerPromise) {
				_producerPromise.resolve(producer);
			}
		});

		producer.once('error', (err) => {
			if (null != _connectTimeout) {
				clearTimeout(_connectTimeout);
				_connectTimeout = null;
			}
			onError(err);
		});

		// Check that zookeeper actually connected after a short time.
		// This allows us to close the promise even if the ready event is never fired.
		_connectTimeout = setTimeout(() => {
			_connectTimeout = null;

			// If the promise has not yet been resolved, emit an error in the producer.
			// This will trigger our error-handling code above.
			if (_producerPromise.promise.isPending()) {
				onError(new Error(`Failed to connect to Zookeeper in ${zookeeperCommTimeout} ms`));
			}
		}, zookeeperCommTimeout);
	}
	catch (err) {
		onError(err);
	}
	return promise;
};

const send = (payloads, retry) => {
	const defer = q.defer();

	// It's important that the payloads are sent in the correct order, so try to resend any queued up
	// payloads before sending the new payload.
	retrySend().then(getProducer).then((producer) => {

		// Send the payload to Kafka.
		const d = q.defer();
		producer.send(payloads, d.makeNodeResolver());
		return d.promise;

	}).then(() => {
		logger.debug('Kafka Producer: Sent payload successfully');
		defer.resolve();

	}).fail((err) => {
		// If we're not bothering to retry, reject the promise immediately.
		if (!retry) {
			defer.reject(err);
		}
		// Otherwise, store the payloads and promise
		else {
			_retryPayloads = _retryPayloads.concat(payloads);
			_retryPromises.push(defer);
			scheduleRetry();
		}
	});
	return defer.promise;
};

const retrySend = () => {
	// If there is a timeout set to call this function, cancel it.
	if (null != _timeout) {
		clearTimeout(_timeout);
		_timeout = null;
	}

	// If we're already retrying, don't do it again.
	if (null != _retryPromise) {
		return _retryPromise.promise;
	}

	// If there aren't any stored payloads, we're done.
	if (_retryPayloads.length === 0) {
		return q.resolve();
	}

	_retryPromise = q.defer();

	// Try sending all of the stored payloads to Kafka and see what happens.
	getProducer().then((producer) => {

		// Send the payload to Kafka
		const d = q.defer();
		producer.send(_retryPayloads, d.makeNodeResolver());
		return d.promise;

	}).then((results) => {
		// Resolve all the deferred promises
		_retryPromises.forEach((promise) => {
			promise.resolve();
		});

		// Clear out all the payloads and promises.
		_retryPayloads = [];
		_retryPromises = [];

		// Indicate that the retry function has completed.
		_retryPromise.resolve();
		_retryPromise = null;

	}).fail((err) => {
		// Schedule the retry again.
		scheduleRetry();

		// Indicate that the retry function has failed.
		// If this was called by the send() function, there is no need for that function to try sending its
		// own payload because we know the previous ones are still failing.
		_retryPromise.reject(err);
		_retryPromise = null;
	});
	return _retryPromise.promise;
};

const scheduleRetry = () => {
	if (null == _timeout) {
		logger.info(`Kafka Producer: Attempting to resend payloads in ${retryMs} ms`);
		_timeout = setTimeout(() => {
			_timeout = null;
			retrySend();
		}, retryMs);
	}
};

/**
 * @type {number} The number of milliseconds to wait before retrying a send
 */
module.exports.retryMs = retryMs;

module.exports.events = _events;
/**
 * Sends an array of payloads to Kafka.  If the payload fails and the retry flag is set, we will continue
 * retrying the send until it is successful.
 *
 * @param {Array} payloads An array of payloads.  Each payload must be an object with the following keys:
 *   - topic: The topic to which to send
 *   - messages: A string or array of strings to send to the topic
 *
 * @param {Boolean} retry If true, the payload will continue to be sent until it is successful.  If false,
 *   the payload will be sent once and will be ignored if it fails.
 *
 * @returns {Promise} A promise that is resolved when the send is successful, and rejected if it fails and
 *   retry is set to false.  If retry is true, the promise will only be resolved when a successful send
 *   is finally made.
 */
module.exports.send = send;

/**
 * Sends an array of payloads to Kafka.  If the payload fails and the retry flag is set, we will continue
 * retrying the send until it is successful.
 *
 * @param {String} topic The topic to send the message to.
 * @param {String} message An array or string containing the message or messages to send.
 * @param {Boolean} retry If true, the payload will continue to be sent until it is successful.  If false,
 *   the payload will be sent once and will be ignored if it fails.
 *
 * @returns {Promise} A promise that is resolved when the send is successful, and rejected if it fails and
 *   retry is set to false.  If retry is true, the promise will only be resolved when a successful send
 *   is finally made.
 */
module.exports.sendMessageForTopic = (topic, message, retry) => {
	return send([{topic: topic, messages: message}], retry);
};

/**
 * Sends an array of payloads to Kafka.  If the payload fails and the retry flag is set, we will continue
 * retrying the send until it is successful.
 *
 * @param {String} topic The topic to send the message to.
 * @param {String} message An array or string containing the message or messages to send.
 * @param {String} key a string that is the key for the message
 * @param {Boolean} retry If true, the payload will continue to be sent until it is successful.  If false,
 *   the payload will be sent once and will be ignored if it fails.
 *
 * @returns {Promise} A promise that is resolved when the send is successful, and rejected if it fails and
 *   retry is set to false.  If retry is true, the promise will only be resolved when a successful send
 *   is finally made.
 */
module.exports.sendMessageForTopicWithKey = (topic, message, key, retry) => {
	return send([{topic: topic, messages: message, key: key}], retry);
};
