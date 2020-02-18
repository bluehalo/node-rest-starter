'use strict';

const
	q = require('q'),

	deps = require('../../../../dependencies'),
	dbs = deps.dbs,
	util = deps.utilService,
	logger = deps.logger,
	auditService = deps.auditService,

	TeamMember = dbs.admin.model('TeamUser'),
	User = dbs.admin.model('User'),
	UserAgreement = dbs.admin.model('UserAgreement');


// Search (Retrieve) all user Agreements
module.exports.searchEuas = (req, res) => {

	// Handle the query/search/page
	const query = req.body.q;
	const search = req.body.s;

	let page = req.query.page;
	let size = req.query.size;
	const sort = req.query.sort;
	let dir = req.query.dir;

	// Limit has to be at least 1 and no more than 100
	if (null == size) { size = 20; }
	size = Math.max(1, Math.min(100, size));

	// Page needs to be positive and has no upper bound
	if (null == page) { page = 0; }
	page = Math.max(0, page);

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if (null != sort && dir == null) { dir = 'DESC'; }

	// Create the variables to the search call
	const limit = size;
	const offset = page*size;
	let sortArr;
	if (null != sort) {
		sortArr = [{ property: sort, direction: dir }];
	}

	UserAgreement.search(query, search, limit, offset, sortArr)
		.then(
			(result) => {
				const toReturn = {
					totalSize: result.count,
					pageNumber: page,
					pageSize: size,
					totalPages: Math.ceil(result.count / size),
					elements: result.results
				};

				return q(toReturn);
			})
		.then(
			(results) => {
				res.status(200).json(results);
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
};


// Publish the EUA
module.exports.publishEua = (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;
	eua.published = Date.now();

	eua.save()
		.then(
			(results) => {
				res.status(200).json(results);
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
};


// Accept the current EUA
module.exports.acceptEua = (req, res) => {
	// Make sure the user is logged in
	if (null == req.user) {
		util.handleErrorResponse(res, { status: 400, type: 'error', message: 'User is not signed in' });
	}
	else {
		// Audit accepted eua
		auditService.audit('eua accepted', 'eua', 'accepted', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), {}, req.headers).then(
				() => {
					return User.findOneAndUpdate(
						{ _id: req.user._id },
						{ acceptedEua: Date.now() },
						{ new: true, upsert: false }).exec();
				})
			.then(
				(user) => {
					res.status(200).json(User.fullCopy(user));
				},
				(err) => {
					util.handleErrorResponse(res, err);
				})
			.done();
	}
};

// Create a new User Agreement
module.exports.createEua = (req, res) => {
	const eua = new UserAgreement(req.body);
	eua.created = Date.now();
	eua.updated = eua.created;

	// Audit eua creates
	auditService.audit('eua create', 'eua', 'create', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), UserAgreement.auditCopy(eua), req.headers).then(
			() => {
				return eua.save();
			})
		.then(
			(results) => {
				res.status(200).json(results);
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
};


// Retrieve the Current User Agreement
module.exports.getCurrentEua = (req, res) => {
	UserAgreement.getCurrentEua()
		.then(
			(results) => {
				res.status(200).json(results);
			},
			(err) => {
				util.handleErrorResponse(res, err);
			})
		.done();
};


// Retrieve the arbitrary User Agreement
module.exports.getEuaById = (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	if (null == eua) {
		util.handleErrorResponse(res, { status: 400, type: 'error', message: 'End User Agreement does not exist' });
	}
	else {
		res.status(200).json(eua);
	}
};


// Update a User Agreement
module.exports.updateEua = (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	// A copy of the original eua for auditing
	const originalEua = UserAgreement.auditCopy(eua);

	if (null == eua) {
		util.handleErrorResponse(res, { status: 400, type: 'error', message: 'Could not find end user agreement' });
	}
	else {
		// Copy over the new user properties
		eua.text = req.body.text;
		eua.title = req.body.title;

		// Update the updated date
		eua.updated = Date.now();

		// Audit user update
		auditService.audit('end user agreement updated', 'eua', 'update', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), {
				before: originalEua,
				after: UserAgreement.auditCopy(eua)
			}, req.headers).then(
				() => {
					return eua.save();
				})
			.then(
				(results) => {
					res.status(200).json(results);
				},
				(err) => {
					util.handleErrorResponse(res, err);
				})
			.done();
	}
};


// Delete a User Agreement
module.exports.deleteEua = (req, res) => {
	// The eua is placed into this parameter by the middleware
	const eua = req.euaParam;

	if (null == eua) {
		util.handleErrorResponse(res, { status: 400, type: 'error', message: 'Could not find end user agreement' });
	}
	else {
		// Audit eua delete
		auditService.audit('eua deleted', 'eua', 'delete', TeamMember.auditCopy(req.user, util.getHeaderField(req.headers, 'x-real-ip')), UserAgreement.auditCopy(eua), req.headers).then(
				() => {
					return eua.remove();
				})
			.then(
				(results) => {
					res.status(200).json(results);
				},
				(err) => {
					util.handleErrorResponse(res, err);
				})
			.done();
	}
};


// EUA middleware - stores user corresponding to id in 'euaParam'
module.exports.euaById = (req, res, next, id) => {
	UserAgreement.findOne({ _id: id })
		.exec()
		.then(
			(eua) => {
				if (null == eua) {
					return next(new Error(`Failed to load User Agreement ${id}`));
				}
				req.euaParam = eua;
				return next();
			}, next);
};


/**
 * Check the state of the EUA
 */
module.exports.requiresEua = (req) => {
	return UserAgreement.getCurrentEua()
		.then(
			(result) => {
				// Compare the current eua to the user's acceptance state
				if (null == result || null == result.published || (req.user.acceptedEua && req.user.acceptedEua >= result.published)) {
					// if the user's acceptance is valid, then proceed
					return q();
				} else {
					return q.reject({ status: 403, type: 'eua', message: 'User must accept end-user agreement.'});
				}
			},
			(error) => {
				// Failure
				logger.error(error);
				return q.reject({ status: 500, type: 'error', error: error });
			});
};

