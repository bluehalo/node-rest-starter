const EventEmitter = require('events');

/**
 * EventEmitter
 * This service provides a singleton event emitter as a substitute for a proper
 * external messaging system (e.g, RabbitMQ, Kafka, etc.)
 * Only use this EventEmitter in single-instance installations or for dev purposes
 */
const eventEmitter = new EventEmitter.EventEmitter();

function getEventEmitter() {
	return eventEmitter;
}

module.exports = {
	getEventEmitter: getEventEmitter
};
