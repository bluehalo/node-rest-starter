'use strict';

const config = require('../config');
const logger = require('./bunyan').logger;

const metricsConfig = config?.metrics || {};
const metricsEnabled = metricsConfig?.enabled || false;

const metricsPrefix = `${
	metricsConfig?.prefix ? `${metricsConfig.prefix}_` : ''
}`;

/** @type {import('prom-client')} */
let Prometheus;

/** @type {import('prom-client').Registry} */
let register;

/** @type {import('prom-client').Counter} */
let requestCounter;

/** @type {import('prom-client').Histogram} */
let requestDurationHistogram;

/**
 * Initialize the Prometheus registry
 */
const start = () => {
	// Bypass start function if metrics are disabled
	if (!metricsEnabled) {
		return;
	}

	logger.info('Initializing Prometheus Exporter');

	Prometheus = require('prom-client');
	register = new Prometheus.Registry();

	// If configured, will collect and return common Node specific metrics
	if (metricsConfig?.collectDefaultMetrics || false) {
		const collectDefaultMetrics = Prometheus.collectDefaultMetrics;
		collectDefaultMetrics({ register });
	}

	_initializeRequestMetrics();
};

/**
 * Retrieve current metrics
 * @returns {Promise<string>}
 */
const getMetrics = () => {
	if (!metricsEnabled) {
		return Promise.reject('Metrics not configured');
	}

	return register.metrics();
};

/**
 * Create and intialize the HTTP Request specific metric objects.
 */
const _initializeRequestMetrics = () => {
	requestCounter = new Prometheus.Counter({
		name: `${metricsPrefix}http_requests_total`,
		help: 'Counter for total requests received',
		labelNames: ['route', 'method', 'status'],

		registers: [register]
	});

	requestDurationHistogram = new Prometheus.Histogram({
		name: `${metricsPrefix}http_request_duration_seconds`,
		help: 'Duration of HTTP requests in seconds',
		labelNames: ['route', 'method', 'status'],

		registers: [register]
	});
};

/**
 * Express middleware to enable prometheus metrics monitoring for individual endpoints
 * @param {string} route route identifier to track metrics by
 */
const requestMetricsMiddleware = (route) => {
	// Return stub pass-through method if metrics are disabled.
	if (!metricsEnabled) {
		return (req, res, next) => {
			next();
		};
	}

	return (req, res, next) => {
		// Track start of request duration
		const start = Date.now();

		res.on('finish', () => {
			const { method } = req;
			const status = res.statusCode.toString();

			// Create Prometheus label structure
			const labels = { route, method, status };

			const end = Date.now();
			const diffs = (end - start) / 1000;

			// Adjust request metric objects
			requestCounter.inc(labels, 1);
			requestDurationHistogram.observe(labels, diffs);
		});
		next();
	};
};

module.exports = {
	start,
	getMetrics,

	requestMetricsMiddleware
};
