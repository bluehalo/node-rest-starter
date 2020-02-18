'use strict';

const
	nodeUtil = require('util'),
	path = require('path'),

	deps = require('../../../dependencies'),
	config = deps.config,
	logger = deps.logger,
	socketIO = deps.socketIO,

	socketProvider = require(path.posix.resolve(config.socketProvider)),
	users = require('../user/user.controller'),

	emitName = 'message';

/**
 * MessageSocket Socket Controller that overrides Base Socket Controller
 * methods to handle specifics of Messages
 */
function MessageSocket(...args) {
	this._emitType = `${emitName}:data`;
	this._topicName = config.messages.topic;
	this._subscriptionCount = 0;
	socketProvider.apply(this, args);
}

nodeUtil.inherits(MessageSocket, socketProvider);

MessageSocket.prototype.name = 'MessageSocket';

/**
 * @override
 *
 */
MessageSocket.prototype.getEmitMessageKey = () => {
	return '';
};

/**
 * Returns the topic for a user ID.
 */
MessageSocket.prototype.getTopic = function(userId) {
	return this._topicName;
};

/**
 * Handle socket disconnects
 */
MessageSocket.prototype.disconnect = function() {
	logger.info('MessageSocket: Disconnected from client.');

	this.unsubscribe(this.getTopic());

};

/**
 * Handle socket errors
 */
MessageSocket.prototype.error = function(err) {
	logger.error(err, 'MessageSocket: Client connection error');

	this.unsubscribe(this.getTopic());
};

/**
 *
 */
MessageSocket.prototype.handleSubscribe = function(payload) {
	const self = this;

	if(logger.debug()) {
		logger.debug(`MessageSocket: ${emitName}:subscribe event with payload: ${JSON.stringify(payload)}`);
	}

	// Check that the user account has access
	self.applyMiddleware([
		users.hasAccess
	]).then(() => {
		// Subscribe to the user's message topic
		const topic = self.getTopic();
		self.subscribe(topic);
		self._subscriptionCount++;
	}, (err) => {
		logger.warn(`Unauthorized access to notifications by inactive user ${self.getUserId()}: ${err}`);
	});
};

/**
 *
 */
MessageSocket.prototype.handleUnsubscribe = function(payload) {
	if(logger.debug()) {
		logger.debug(`MessageSocket: ${emitName}:unsubscribe event with payload: ${JSON.stringify(payload)}`);
	}

	const topic = this.getTopic();
	this.unsubscribe(topic);

	this._subscriptionCount = Math.max(0, this._subscriptionCount - 1);
	// If we are no longer listening for anything, unsubscribe
	if (this._subscriptionCount === 0) {
		this.unsubscribe(this.getTopic());
	}
};

/**
 *
 */
MessageSocket.prototype.addListeners = function() {
	const s = this.getSocket();

	if(typeof s.on === 'function') {
		// Set up Subscribe events
		s.on(`${emitName}:subscribe`, this.handleSubscribe.bind(this));

		// Set up Unsubscribe events
		s.on(`${emitName}:unsubscribe`, this.handleUnsubscribe.bind(this));
	}
};

socketIO.registerSocketListener(MessageSocket);

module.exports = MessageSocket;
