'use strict';

/* eslint-disable no-console */
import http from 'node:http';

import config from 'config';

const options = {
	hostname: 'localhost',
	port: config.get('port'),
	path: '/actuator/health',
	method: 'GET'
};

http
	.request(options, (res) => {
		let body = '';

		res.on('data', (chunk) => {
			body += chunk;
		});

		res.on('end', () => {
			try {
				const response = JSON.parse(body);
				if (response.status === 'UP') {
					process.exit(0);
				}

				console.log('Unhealthy response received: ', body);
				process.exit(1);
			} catch (err) {
				console.log('Error parsing JSON response body: ', err);
				process.exit(1);
			}
		});
	})
	.on('error', (err) => {
		console.log('Error: ', err);
		process.exit(1);
	})
	.end();
