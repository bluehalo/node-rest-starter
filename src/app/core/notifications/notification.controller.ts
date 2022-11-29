import notificationsService from './notification.service';

export const search = async (req, res) => {
	// Get search and query parameters
	const query = req.body.q ?? {};

	// Always need to filter by user making the service call
	query.user = req.user._id;

	const result = await notificationsService.search(req.query, query);
	res.status(200).json(result);
};
