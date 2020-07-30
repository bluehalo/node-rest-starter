const
	deps = require('../../../../dependencies'),
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
	// Copy over the new user properties
	eua.text = updatedEua.text;
	eua.title = updatedEua.title;

	// Update the updated date
	eua.updated = Date.now();

	return eua.save();
};

const remove = (eua) => {
	return eua.remove();
};

const search = async (queryParams, query, _search) => {
	query = query || {};
	const page = util.getPage(queryParams);
	const limit = util.getLimit(queryParams);
	const sortArr = util.getSort(queryParams,'DESC');
	const offset = page * limit;

	const euas = await UserAgreement.textSearch(query, _search, limit, offset, sortArr, true);

	return util.getPagingResults(limit, page, euas.count, euas.results);
};

const publishEua = (eua) => {
	eua.published = Date.now();

	return eua.save();
};

const getCurrentEua = () => {
	return UserAgreement.findOne({ 'published': { '$ne': null, '$exists': true } })
		.sort({ 'published': -1 })
		.exec();
};

const acceptEua = (user) => {
	return User.findOneAndUpdate(
		{ _id: user._id },
		{ acceptedEua: Date.now() },
		{ new: true, upsert: false }).exec();
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
