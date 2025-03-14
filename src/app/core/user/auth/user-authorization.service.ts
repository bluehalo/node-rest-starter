'use strict';

import path from 'node:path';

import _ from 'lodash';
import { FilterQuery } from 'mongoose';

import { ExternalRoleMapProvider } from './external-role-map.provider';
import { config } from '../../../../dependencies';
import { IUser, UserDocument } from '../user.model';

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

		const localRoles = user.roles as Record<string, boolean>;

		const hasLocalRole = localRoles?.[role] ?? false;
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

	updateRoles(user: Pick<IUser, 'roles' | 'localRoles'>) {
		if (this.provider) {
			const strategy = this.getRoleStrategy();
			const isHybrid = strategy === 'hybrid';

			if (isHybrid) {
				user.localRoles = Object.assign({}, user.roles);
			}
			if (strategy === 'external' || isHybrid) {
				const updatedRoles: Record<string, boolean> = {};
				for (const key of this.getRoles()) {
					updatedRoles[key] =
						(isHybrid &&
							user.roles &&
							(user.roles as Record<string, boolean>)[key]) ||
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

	/**
	 * ==========================================================
	 * Private methods
	 * ==========================================================
	 */
	getRoleStrategy() {
		return config.get<string>('auth.roleStrategy');
	}

	getRoles() {
		return config.get<string[]>('auth.roles');
	}

	/**
	 * Initializes the provider only once. Use the getProvider() method
	 * to create and/or retrieve this singleton
	 */
	async loadProvider(reload = false): Promise<ExternalRoleMapProvider> {
		if (!this.provider || reload) {
			try {
				const { default: Provider } = await import(
					path.posix.resolve(config.get('auth.externalRoles.provider.file'))
				);
				this.provider = new Provider(
					config.get('auth.externalRoles.provider.config')
				);
			} catch {
				throw new Error(
					`Failed to load external role map provider: ${config.get(
						'auth.externalRoles.provider.file'
					)}`
				);
			}
		}
		return this.provider;
	}
}

export = new UserAuthorizationService();
