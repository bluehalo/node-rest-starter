'use strict';

const deps = require('../../../dependencies'),
	metrics = deps.metrics,
	metricsLogger = deps.metricsLogger;

// handle a generic client metrics event
exports.handleClientEvent = function (req, res) {
	metricsLogger.log(req.body);
	res.status(200).send();
};

exports.getPrometheusMetrics = function (req, res) {
	metrics
		.getMetrics()
		.then((metrics) => {
			res.status(200).send(metrics);
		})
		.catch((err) => {
			res.status(500).json({ message: err });
		});
};
