import { spy, stub } from 'sinon';

export const getResponseSpy = () => {
	const res = {
		json: spy(),
		end: spy(),
		redirect: spy(),
		status: stub()
	};
	res.status.returns(res);
	return res;
};
