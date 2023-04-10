import { auditService } from '../../../../dependencies';
import euaService from './eua.service';

// Search (Retrieve) all user Agreements
export const searchEuas = async (req, res) => {
	// Handle the query/search
	const query = req.body.q ?? {};
	const search = req.body.s ?? null;

	const results = await euaService.search(req.query, search, query);
	res.status(200).json(results);
};

// Publish the EUA
export const publishEua = async (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	const result = await euaService.publishEua(eua);

	// Audit eua create
	await auditService.audit(
		'eua published',
		'eua',
		'published',
		req,
		result.auditCopy()
	);

	res.status(200).json(result);
};

// Accept the current EUA
export const acceptEua = async (req, res) => {
	const user = await euaService.acceptEua(req.user);

	// Audit accepted eua
	await auditService.audit('eua accepted', 'eua', 'accepted', req, {});

	res.status(200).json(user.fullCopy());
};

// Create a new User Agreement
export const createEua = async (req, res) => {
	const result = await euaService.create(req.body);

	// Audit eua create
	await auditService.audit(
		'eua create',
		'eua',
		'create',
		req,
		result.auditCopy()
	);

	res.status(200).json(result);
};

// Retrieve the Current User Agreement
export const getCurrentEua = async (req, res) => {
	const results = await euaService.getCurrentEua();
	res.status(200).json(results);
};

// Retrieve the arbitrary User Agreement
export const read = (req, res) => {
	res.status(200).json(req.euaParam);
};

// Update a User Agreement
export const updateEua = async (req, res) => {
	// A copy of the original eua for auditing purposes
	const originalEua = req.euaParam.auditCopy();

	const results = await euaService.update(req.euaParam, req.body);

	// Audit user update
	await auditService.audit('end user agreement updated', 'eua', 'update', req, {
		before: originalEua,
		after: results.auditCopy()
	});

	res.status(200).json(results);
};

// Delete a User Agreement
export const deleteEua = async (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	const results = await euaService.delete(eua);

	// Audit eua delete
	await auditService.audit(
		'eua deleted',
		'eua',
		'delete',
		req,
		eua.auditCopy()
	);

	res.status(200).json(results);
};

// EUA middleware - stores user corresponding to id in 'euaParam'
export const euaById = async (req, res, next, id) => {
	const eua = await euaService.read(id);
	if (null == eua) {
		return next(new Error(`Failed to load User Agreement ${id}`));
	}
	req.euaParam = eua;
	return next();
};

/**
 * Check the state of the EUA
 */
export const requiresEua = async (req) => {
	let result;
	try {
		result = await euaService.getCurrentEua();
	} catch (error) {
		return Promise.reject({ status: 500, type: 'error', error: error });
	}

	// Compare the current eua to the user's acceptance state
	if (
		null == result ||
		null == result.published ||
		(req.user.acceptedEua && req.user.acceptedEua >= result.published)
	) {
		// if the user's acceptance is valid, then proceed
		return Promise.resolve();
	}
	return Promise.reject({
		status: 403,
		type: 'eua',
		message: 'User must accept end-user agreement.'
	});
};
