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
describe('Kafka Socket Controller:', function() {

	let ctrl;

	before(function() {

		// Mock out the subscribe and unsubscribe methods to do nothing
		let noOp = function() {};
		KafkaSocket.prototype.subscribe = noOp;
		KafkaSocket.prototype.unsubscribe = noOp;

		// Initialize
		ctrl = new KafkaSocket({
			socket: {}
		});
	});

	describe('should pass socket through to base', function() {

		it('base socket controller should have the socket object', function() {
			let s = ctrl.getSocket();
			should.exist(s);
		});

	});

	describe('should set default emit values', function() {

		it('default emit type', function() {
			let type = ctrl.getEmitType();
			should(type).equal('payload');
		});

	});

});
