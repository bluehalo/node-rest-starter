import { metricsLogger } from '../../../dependencies';

// handle a generic client metrics event
export const handleEvent = (req, res) => {
	metricsLogger.log(req.body);
	res.status(200).send();
};
