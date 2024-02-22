type RequirementFunction = (
	req: unknown,
	res: unknown,
	next: unknown
) => Promise<unknown>;

/**
 * Apply the auth requirements as authorization middleware
 * @param requirement The requirement function to invoke
 */
export const has = (requirement: RequirementFunction) => {
	// Return a function that adapts the requirements to middleware
	return (req, res, next) => {
		Promise.resolve(requirement(req, req, next))
			.then(() => {
				next();
			})
			.catch(next);
	};
};

/**
 * Apply the array of auth functions in order, using AND logic
 */
export const hasAll = (...requirements: Array<RequirementFunction>) => {
	return (req, res, next) => {
		Promise.resolve(requiresAll(requirements)(req, res, next))
			.then(() => {
				next();
			})
			.catch(next);
	};
};

/**
 * Apply the array of auth functions in order, using OR logic
 */
export const hasAny = (...requirements: Array<RequirementFunction>) => {
	return (req, res, next) => {
		Promise.resolve(requiresAny(requirements)(req, res, next))
			.then(() => {
				next();
			})
			.catch(next);
	};
};

export const requiresAll = (requirements: Array<RequirementFunction>) => {
	return (req, res, next) => {
		// Apply the requirements
		const applyRequirement = (i) => {
			if (i < requirements.length) {
				return requirements[i](req, res, next).then(() => {
					// Success means try the next one
					return applyRequirement(++i);
				});
			}
			// Once they all pass, we're good
			return Promise.resolve();
		};

		return applyRequirement(0);
	};
};

export const requiresAny = (requirements: Array<RequirementFunction>) => {
	return (req, res, next) => {
		// Apply the requirements
		let error;
		const applyRequirement = (i) => {
			if (i < requirements.length) {
				return requirements[i](req, res, next)
					.then(() => {
						// Success means we're done
						return Promise.resolve();
					})
					.catch((errorResult) => {
						// Failure means keep going
						error = errorResult;
						return applyRequirement(++i);
					});
			}
			// If we run out of requirements, fail with the last error
			return Promise.reject(error);
		};

		if (requirements.length > 0) {
			return applyRequirement(0);
		}
		// Nothing to check passes
		return Promise.resolve();
	};
};
