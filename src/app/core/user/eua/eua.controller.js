'use strict';

const
	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	auditService = deps.auditService,
	euaService = require('./eua.service'),

	TeamMember = dbs.admin.model('TeamUser'),
	User = dbs.admin.model('User'),
	UserAgreement = dbs.admin.model('UserAgreement');

// Search (Retrieve) all user Agreements
module.exports.searchEuas = async (req, res) => {
	// Handle the query/search
	const query = req.body.q;
	const search = req.body.s;

	try {
		const results = await euaService.search(req.query, query, search);
		res.status(200).json(results);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

// Publish the EUA
module.exports.publishEua = async (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	if (null == eua) {
		return util.handleErrorResponse(res, {
			status: 400,
			type: 'error',
			message: 'Could not find end user agreement'
		});
	}

	try {
		const result = await euaService.publishEua(eua);

		// Audit eua create
		await auditService.audit('eua published', 'eua', 'published', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), UserAgreement.auditCopy(result), req.headers);

		res.status(200).json(result);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}

};

// Accept the current EUA
module.exports.acceptEua = async (req, res) => {
	try {
		const user = await euaService.acceptEua(req.user);

		// Audit accepted eua
		await auditService.audit('eua accepted', 'eua', 'accepted', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), {}, req.headers);

		res.status(200).json(User.fullCopy(user));
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

// Create a new User Agreement
module.exports.createEua = async (req, res) => {
	try {
		const result = euaService.create(req.body);

		// Audit eua create
		await auditService.audit('eua create', 'eua', 'create', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), UserAgreement.auditCopy(result), req.headers);

		res.status(200).json(result);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

// Retrieve the Current User Agreement
module.exports.getCurrentEua = async (req, res) => {
	try {
		const results = await euaService.getCurrentEua();
		res.status(200).json(results);
	} catch(err) {
		util.handleErrorResponse(res, err);
	}
};

// Retrieve the arbitrary User Agreement
module.exports.getEuaById = (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	if (null == eua) {
		return util.handleErrorResponse(res, { status: 400, type: 'error', message: 'End User Agreement does not exist' });
	}
	res.status(200).json(eua);
};

// Update a User Agreement
module.exports.updateEua = async (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	if (null == eua) {
		return util.handleErrorResponse(res, { status: 400, type: 'error', message: 'Could not find end user agreement' });
	}
	try {
		// A copy of the original eua for auditing
		const originalEua = UserAgreement.auditCopy(eua);

		const results = await euaService.update(eua, req.body);

		// Audit user update
		await auditService.audit('end user agreement updated', 'eua', 'update', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), {
			before: originalEua,
			after: UserAgreement.auditCopy(results)
		}, req.headers);

		res.status(200).json(results);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
};

// Delete a User Agreement
module.exports.deleteEua = async (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	if (null == eua) {
		return util.handleErrorResponse(res, { status: 400, type: 'error', message: 'Could not find end user agreement' });
	}
	try {
		const results = await euaService.remove(eua);

		// Audit eua delete
		await auditService.audit('eua deleted', 'eua', 'delete', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), UserAgreement.auditCopy(eua), req.headers);

		res.status(200).json(results);
	} catch (err) {
		util.handleErrorResponse(res, err);
	}
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
	if (null == result || null == result.published || (req.user.acceptedEua && req.user.acceptedEua >= result.published)) {
		// if the user's acceptance is valid, then proceed
		return Promise.resolve();
	}
	return Promise.reject({ status: 403, type: 'eua', message: 'User must accept end-user agreement.'});
};
