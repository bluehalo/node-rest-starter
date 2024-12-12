import through2 from 'through2';

export = function (delay = 10) {
	// Store all the active timeouts
	let timeouts: NodeJS.Timeout[] = [];

	// Flush function: wait until all the timeouts are done before we forward the finish command
	function onFlush(callback: () => unknown) {
		// If there are still pending requests, check again soon
		if (timeouts.length > 0) {
			setTimeout(() => {
				onFlush(callback);
			}, delay + 10);
		}
		// We're done with all the requests
		else {
			return callback();
		}
	}

	// Create a stream that applies a timeout to each payload.
	const stream = through2.obj((chunk, enc, callback) => {
		// After a delay, pass the chunk on to the next stream handler
		const t = setTimeout(() => {
			timeouts.splice(timeouts.indexOf(t), 1);

			callback(null, chunk);
		}, delay);

		timeouts.push(t);
	}, onFlush);

	// If an upstream processor has an error, stop doing anything we had queued up.
	// This allows us to quickly short-circuit.
	stream.on('error', () => {
		timeouts.forEach((t) => {
			clearTimeout(t);
		});
		timeouts = [];
	});

	return stream;
};
