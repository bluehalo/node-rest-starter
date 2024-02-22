import { StatusCodes } from 'http-status-codes';

import accessCheckerService from './access-checker.service';
import cacheEntryService from './cache/cache-entry.service';

/**
 * Public methods
 */
// Match users given a search fragment
export const matchEntries = async (req, res) => {
	const results = await cacheEntryService.search(
		req.query,
		req.body.s,
		req.body.q
	);

	// Create the return copy of the messages
	const mappedResults = {
		pageNumber: results.pageNumber,
		pageSize: results.pageSize,
		totalPages: results.totalPages,
		totalSize: results.totalSize,
		elements: results.elements.map((element) => element.fullCopy())
	};

	res.status(StatusCodes.OK).json(mappedResults);
};

export const refreshEntry = async (req, res) => {
	await accessCheckerService.refreshEntry(req.params.key);
	res.status(StatusCodes.NO_CONTENT).end();
};

export const deleteEntry = async (req, res) => {
	await cacheEntryService.delete(req.params.key);
	res.status(StatusCodes.NO_CONTENT).end();
};

export const refreshCurrentUser = async (req, res) => {
	await accessCheckerService.refreshEntry(req.user?.providerData?.dnLower);
	res.status(StatusCodes.NO_CONTENT).end();
};
