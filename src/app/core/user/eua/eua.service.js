const deps = require('../../../../dependencies'),
	util = deps.utilService,
	dbs = deps.dbs,
	User = dbs.admin.model('User'),
	UserAgreement = dbs.admin.model('UserAgreement');

const create = (input) => {
	const eua = new UserAgreement(input);
	eua.created = Date.now();
	eua.updated = eua.created;

	return eua.save();
};

const read = (id, populate = []) => {
	return UserAgreement.findById(id).populate(populate).exec();
};

const update = (eua, updatedEua) => {
	// Copy over the new eua properties
	eua.text = updatedEua.text;
	eua.title = updatedEua.title;

	// Update the updated date
	eua.updated = Date.now();

	return eua.save();
};

const remove = (eua) => {
	return eua.remove();
};

const search = (queryParams, query, _search) => {
	query = query || {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams);
	const sort = util.getSortObj(queryParams, 'DESC');

	return UserAgreement.find(query)
		.textSearch(_search)
		.sort(sort)
		.paginate(limit, page);
};

const publishEua = (eua) => {
	eua.published = Date.now();

	return eua.save();
};

const getCurrentEua = () => {
	return UserAgreement.findOne({ published: { $ne: null, $exists: true } })
		.sort({ published: -1 })
		.exec();
};

const acceptEua = (user) => {
	return User.findOneAndUpdate(
		{ _id: user._id },
		{ acceptedEua: Date.now() },
		{ new: true, upsert: false }
	).exec();
};

module.exports = {
	create,
	read,
	update,
	remove,
	search,
	publishEua,
	acceptEua,
	getCurrentEua
};
