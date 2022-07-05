'use strict';

const { dbs, auditService } = require('../../../../dependencies'),
	euaService = require('./eua.service'),
	User = dbs.admin.model('User'),
	UserAgreement = dbs.admin.model('UserAgreement');

// Search (Retrieve) all user Agreements
module.exports.searchEuas = async (req, res) => {
	// Handle the query/search
	const query = req.body.q ?? {};
	const search = req.body.s ?? null;

	const results = await euaService.search(req.query, query, search);
	res.status(200).json(results);
};

// Publish the EUA
module.exports.publishEua = async (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	const result = await euaService.publishEua(eua);

	// Audit eua create
	await auditService.audit(
		'eua published',
		'eua',
		'published',
		req,
		UserAgreement.auditCopy(result)
	);

	res.status(200).json(result);
};

// Accept the current EUA
module.exports.acceptEua = async (req, res) => {
	const user = await euaService.acceptEua(req.user);

	// Audit accepted eua
	await auditService.audit('eua accepted', 'eua', 'accepted', req, {});

	res.status(200).json(User.fullCopy(user));
};

// Create a new User Agreement
module.exports.createEua = async (req, res) => {
	const result = await euaService.create(req.body);

	// Audit eua create
	await auditService.audit(
		'eua create',
		'eua',
		'create',
		req,
		UserAgreement.auditCopy(result)
	);

	res.status(200).json(result);
};

// Retrieve the Current User Agreement
module.exports.getCurrentEua = async (req, res) => {
	const results = await euaService.getCurrentEua();
	res.status(200).json(results);
};

// Retrieve the arbitrary User Agreement
module.exports.read = (req, res) => {
	res.status(200).json(req.euaParam);
};

// Update a User Agreement
module.exports.updateEua = async (req, res) => {
	// A copy of the original eua for auditing purposes
	const originalEua = UserAgreement.auditCopy(req.euaParam);

	const results = await euaService.update(req.euaParam, req.body);

	// Audit user update
	await auditService.audit('end user agreement updated', 'eua', 'update', req, {
		before: originalEua,
		after: UserAgreement.auditCopy(results)
	});

	res.status(200).json(results);
};

// Delete a User Agreement
module.exports.deleteEua = async (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	const results = await euaService.remove(eua);

	// Audit eua delete
	await auditService.audit(
		'eua deleted',
		'eua',
		'delete',
		req,
		UserAgreement.auditCopy(eua)
	);

	res.status(200).json(results);
};

// EUA middleware - stores user corresponding to id in 'euaParam'
module.exports.euaById = async (req, res, next, id) => {
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
module.exports.requiresEua = async (req) => {
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
