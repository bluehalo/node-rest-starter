'use strict';

const
	should = require('should'),

	KafkaSocket = require('./kafka-socket.provider');

/**
 * Globals
 */


/**
 * Unit tests
 */
describe('Kafka Socket Controller:', () => {

	let ctrl;

	before(() => {

		// Mock out the subscribe and unsubscribe methods to do nothing
		const noOp = function() {};
		KafkaSocket.prototype.subscribe = noOp;
		KafkaSocket.prototype.unsubscribe = noOp;

		// Initialize
		ctrl = new KafkaSocket({
			socket: {}
		});
	});

	describe('should pass socket through to base', () => {

		it('base socket controller should have the socket object', () => {
			const s = ctrl.getSocket();
			should.exist(s);
		});

	});

	describe('should set default emit values', () => {

		it('default emit type', () => {
			const type = ctrl.getEmitType();
			should(type).equal('payload');
		});

	});

});
