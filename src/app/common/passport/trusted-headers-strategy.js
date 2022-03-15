const passport = require('passport');

class TrustedHeadersStrategy extends passport.Strategy {
	constructor(options, verify) {
		if (!verify) {
			throw new Error('Trusted headers strategy requires a verify function');
		}
		if (!options.headers) {
			throw new Error('Trusted headers strategy requires a headers option');
		}
		super();

		this._verify = verify;
		this._headers = options.headers;
	}

	/**
	 * Authenticate request based on the contents of the dn header value.
	 *
	 * @param {import('express').Request} req
	 * @api protected
	 */
	authenticate(req, options) {
		const self = this;

		const headers = this._headers.map((header) => req.headers[header]);

		try {
			// Call the configurable verify function
			self._verify(req, headers, (err, user, info) => {
				// If there was an error, pass it through
				if (err) {
					return self.error(err);
				}
				// If there was no user, fail the auth check
				if (!user) {
					return self.fail(info);
				}
				// Otherwise, succeed
				self.success(user);
			});
		} catch (ex) {
			return self.error(ex);
		}
	}
}

module.exports = TrustedHeadersStrategy;
