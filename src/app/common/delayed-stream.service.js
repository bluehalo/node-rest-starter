'use strict';

var through2 = require('through2');

module.exports = function(delay) {
	delay = delay || 10;

	// Store all the active timeouts
	var timeouts = [];

	// Flush function: wait until all the timeouts are done before we forward the finish command
	function onFlush(callback) {
		// If there are still pending requests, check again soon
		if (timeouts.length > 0) {
			setTimeout(function() {
				onFlush(callback);
			}, delay + 10);
		}
		// We're done with all the requests
		else {
			callback();
		}
	}

	// Create a stream that applies a timeout to each payload.
	var stream = through2.obj(function (chunk, enc, callback) {

		// After a delay, pass the chunk on to the next stream handler
		var t = setTimeout(function() {
			timeouts.splice(timeouts.indexOf(t), 1);

			callback(null, chunk);
		}, delay);

		timeouts.push(t);

	}, onFlush);

	// If an upstream processor has an error, stop doing anything we had queued up.
	// This allows us to quickly short-circuit.
	stream.on('error', function() {
		timeouts.forEach(function(t) {
			clearTimeout(t);
		});
		timeouts = [];
	});

	return stream;
};
