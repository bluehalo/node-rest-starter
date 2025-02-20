import { EventEmitter } from 'node:events';

/**
 * EventEmitter
 * This service provides a singleton event emitter as a substitute for a proper
 * external messaging system (e.g, RabbitMQ, Kafka, etc.)
 * Only use this EventEmitter in single-instance installations or for dev purposes
 */
const eventEmitter = new EventEmitter();

export function getEventEmitter() {
	return eventEmitter;
}
