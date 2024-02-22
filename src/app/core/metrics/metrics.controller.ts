import { StatusCodes } from 'http-status-codes';

import { metricsLogger } from '../../../dependencies';

// handle a generic client metrics event
export const handleEvent = (req, res) => {
	metricsLogger.log({ metricsEvent: req.body });
	res.status(StatusCodes.OK).send();
};
