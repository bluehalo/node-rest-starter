'use strict';

const
	deps = require('../../../dependencies'),
	metricsLogger = deps.metricsLogger;

// handle a generic client metrics event
exports.handleEvent = function(req, res) {

	metricsLogger.log(req.body);
	res.status(200).send();

};
