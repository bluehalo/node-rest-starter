'use strict';

const
	async = require('async'),

	deps = require('../../../dependencies'),
	logger = deps.logger;

function BaseSocket(config) {
	this._socket = config.socket;

	if(typeof this._socket.on === 'function') {
		this._socket.on('disconnect', this.disconnect.bind(this));
		this._socket.on('error', this.error.bind(this));
	}

	this._userId = null;
	this.addListeners();
}
BaseSocket.prototype.name = 'BaseSocket';

/**
 * Base function to handle disconnects from the client
 */
BaseSocket.prototype.disconnect = function() {
	logger.info('BaseSocket: Disconnected from client.');
};

/**
 * Base function to handle errors
 */
BaseSocket.prototype.error = function(err) {
	logger.error(err, 'BaseSocket: Client connection error');
};

/**
 * Base function to get the socket
 */
BaseSocket.prototype.getSocket = function() {
	return this._socket;
};

/**
 * Base function to add listeners for the socket events
 */
BaseSocket.prototype.addListeners = function() {
	logger.debug('BaseSocket: Calling addListeners');
};

BaseSocket.prototype.getUserId = function() {
	if (null == this._userId) {
		const s = this.getSocket();
		if (null != s && null != s.request && null != s.request.user) {
			// Store this for the next request, since it won't change for this socket.
			this._userId = s.request.user.id;
		}
	}
	return this._userId;
};

/**
 * Gets a placeholder request object for the open socket.
 *
 * @returns {Object} An object that looks like an HTTP request.  It will contain the user object from the
 *   actually socket request.
 */
BaseSocket.prototype.getRequest = function() {
	const self = this;

	const data = {};
	data.user = self.getSocket().request.user;

	data.isAuthenticated = function() {
		return self.getSocket().request.isAuthenticated();
	};
	data.isUnauthenticated = function() {
		return self.getSocket().request.isUnauthenticated();
	};
	return data;
};

/**
 * Gets a placeholder response object that can be used for middleware.  It stubs out the status() and send()
 * methods, and if there is an error, forwards it to the next handler.
 *
 * @param {Function} next A callback for the async handler.  It will be called with an error if the middleware
 *   callback function passes any message to the UI.
 *
 * @returns {{status: status, send: send}}
 */
BaseSocket.prototype.getResponse = function(next) {
	function send(data) {
		let err = null;
		if (null != data && null != data.message) {
			err = new Error(data.message);
		}
		else {
			err = new Error('Unauthorized');
		}
		return next(err);
	}

	function status(data) {
		return {
			send: send,
			json: send
		};
	}

	return {
		status: status,
		send: send,
		json: send
	};
};

/**
 * Applies a set of callbacks in series.  Each function should accept a request and response object and
 * a callback function, in the same format as the Express.js middleware.
 *
 * @param {Array{Function}} callbacks An array of middleware callbacks to execute.
 * @param {Function=} done Optionally, a function that will be called when all middleware has processed, either
 *   with an error or without.
 *
 * @returns {Promise} A promise that will be resolved when all the middleware has run.  You can either
 *   listen for this or pass in a callback.
 */
BaseSocket.prototype.applyMiddleware = function(callbacks, done) {
	const self = this;
	return new Promise((resolve, reject) => {
		// Use the same request for all callbacks
		const req = self.getRequest();

		const tasks = callbacks.map((callback) => {
			return function(next) {
				// Create a new response for each next() callback
				const res = self.getResponse(next);

				// Invoke the callback
				callback(req, res, next);
			};
		});
		async.series(tasks, (err, results) => {

			// Get the result from the last task
			const result = results[tasks.length - 1];

			// Invoke the callback if there is one
			if (null != done) {
				done(err, result);
			}

			// In addition to the optional callback,
			// resolve or reject the promise
			if (err) {
				reject(err);
			}
			else {
				resolve(result);
			}
		});
	});
};

module.exports = BaseSocket;
