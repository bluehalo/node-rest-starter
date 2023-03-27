'use strict';

import path from 'path';

import _ from 'lodash';
import { FilterQuery } from 'mongoose';

import { config } from '../../../../dependencies';
import { IUser, UserDocument } from '../user.model';
import { ExternalRoleMapProvider } from './external-role-map.provider';

class UserAuthorizationService {
	provider: ExternalRoleMapProvider;

	constructor() {
		this.loadProvider().then();
	}

	/**
	 * ==========================================================
	 * Public Methods
	 * ==========================================================
	 */
	hasRole(user: IUser, role: string) {
		const strategy = this.getRoleStrategy();

		const localRoles = user.roles || {};

		const hasLocalRole = localRoles[role];
		if (strategy === 'local') {
			return hasLocalRole;
		}

		const hasExternalRole = this.provider?.hasRole(user, role) ?? false;
		if (strategy === 'external') {
			return hasExternalRole;
		}

		return hasLocalRole || hasExternalRole;
	}

	hasRoles(user: IUser, roles?: Array<string>) {
		if (null == roles || roles.length === 0) {
			return true;
		}

		return roles.every((role) => this.hasRole(user, role));
	}

	hasAnyRole(user: IUser, roles?: Array<string>) {
		if (null == roles || roles.length === 0) {
			return true;
		}

		return roles.some((role) => this.hasRole(user, role));
	}

	updateRoles(user) {
		if (this.provider) {
			const strategy = this.getRoleStrategy();
			const isHybrid = strategy === 'hybrid';

			if (isHybrid) {
				user.localRoles = Object.assign({}, user.roles);
			}
			if (strategy === 'external' || isHybrid) {
				const updatedRoles = {};
				for (const key of this.getRoles()) {
					updatedRoles[key] =
						(isHybrid && user.roles && user.roles[key]) ||
						this.provider.hasRole(user, key);
				}
				user.roles = updatedRoles;
			}
		}
	}

	updateUserFilter(query: FilterQuery<UserDocument>) {
		if (this.provider) {
			// Update role filters based on roleStrategy
			const strategy = this.getRoleStrategy();
			const isExternal = strategy === 'external';

			if ((isExternal || strategy === 'hybrid') && query && query.$or) {
				for (const role of this.getRoles()) {
					if (query.$or.some((filter) => filter[`roles.${role}`])) {
						query.$or.push(this.provider.generateFilterForRole(role));
						if (isExternal) {
							_.remove(query.$or, (filter) => filter[`roles.${role}`]);
						}
					}
				}
			}
		}

		return query;
	}

	validateAccessToPersonalResource(user, resource) {
		const isAdmin = null != user.roles && user.roles.admin === true;
		if (isAdmin || resource.creator.equals(user._id)) {
			return Promise.resolve();
		}
		return Promise.reject({
			status: 403,
			type: 'unauthorized',
			message:
				'The user does not have the necessary permissions to access this resource'
		});
	}

	/**
	 * ==========================================================
	 * Private methods
	 * ==========================================================
	 */
	getRoleStrategy() {
		return config?.auth?.roleStrategy ?? 'local';
	}

	getRoles() {
		return config?.auth?.roles ?? ['user', 'editor', 'auditor', 'admin'];
	}

	/**
	 * Initializes the provider only once. Use the getProvider() method
	 * to create and/or retrieve this singleton
	 */
	async loadProvider(reload = false): Promise<ExternalRoleMapProvider> {
		if (!this.provider || reload) {
			const erConfig = config.auth?.externalRoles;
			if (!erConfig.provider?.file) {
				return Promise.reject(
					new Error('Invalid external role map provider configuration.')
				);
			}
			try {
				const { default: Provider } = await import(
					path.posix.resolve(erConfig.provider.file)
				);
				this.provider = new Provider(erConfig.provider.config);
			} catch (err) {
				throw new Error(
					`Failed to load external role map provider: ${erConfig.provider.file}`
				);
			}
		}
		return this.provider;
	}
}

export = new UserAuthorizationService();
