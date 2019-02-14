import * as fs from 'fs';
import * as path from 'path';
import { IPermission } from '@materia/interfaces';

import { App } from '../app';
import { MateriaError } from '../error';
import { Permission } from './permission';

/**
 * @class Permissions
 * @classdesc
 * This class is used to set middlewares to the endpoints.
*/
export class Permissions {
	permissions: Permission[];

	constructor(private app: App) {
		this.app = app;
		this.clear();
	}

	/**
	 * Get a function composed by one or many chained midlewares
	 * @param {Array<string>} - Array of permission names
	 * @returns {function} - A middleware function
	 */
	check(permissionsName: Array<string>) {
		return (req, res, next) => {
			let chain = (req, res, next) => {
				next();
			};

			const rev_permissions = permissionsName.reverse();

			rev_permissions.every(permissionName => {
				const permission = this.permissions.find(
					p => p.name == permissionName
				);

				if ( ! permission ) {
					const err: any = new MateriaError(
						'Could not find permission "' + permissionName + '"'
					);
					res.status(500).json(err.message);
					next(err.message);
					return false;
				}

				const nextchain = chain;
				chain = (req, res, next) => {
					const _next = e => {
						if (e) {
							return res
								.status(401)
								.json(JSON.stringify(e.message));
						}
						nextchain(req, res, next);
					};
					const cl = permission.middleware.default
						? permission.middleware.default
						: permission.middleware;

					try {
						if (this.isClass(cl)) {
							const obj = new cl(this.app);
							obj.check(req, res, _next);
						} else {
							req.app = this.app;
							cl(req, res, _next);
						}
					} catch (e) {
						_next(e);
					}
				};
				return true;
			});
			chain(req, res, next);
		};
	}

	/**
	 * Load all the registered permissions
	 */
	load(): Promise<void> {
		this.clear();
		let permissionsPath, resolvedPath, permissionsRaw;
		try {
			permissionsPath = path.join(
				this.app.path,
				'server',
				'permissions.json'
			);
			resolvedPath = require.resolve(permissionsPath);
			if (require.cache[resolvedPath]) {
				delete require.cache[resolvedPath];
			}
			permissionsRaw = require(permissionsPath);
		} catch (e) {
			return Promise.resolve();
		}
		if (permissionsRaw && permissionsRaw.length) {
			const results = [];
			permissionsRaw.forEach((permissionRaw: IPermission) => {
				if (permissionRaw.file && permissionRaw.name) {
					results.push(this.add(permissionRaw));
				}
			});
			return Promise.all(results).then(() => {
				return;
			});
		} else {
			return Promise.resolve();
		}
	}

	/**
	 * Remove all permissions
	*/
	clear(): void {
		this.permissions = [];
		this.add({
			name: 'Anyone',
			description: 'Anyone are allowed without restriction',
			middleware: (req, res, next) => {
				return next();
			},
			readOnly: true
		});
	}

	/**
	 * Get all the registered permissions objects
	 * @returns {Array<Permission>}
	*/
	findAll(): Array<Permission> {
		return this.permissions;
	}

	/**
	Get a permission's object
	@param {string} - The permission name
	@returns {function} - Permission object
	*/
	get(name: string): Permission {
		return this.permissions.find(permission => {
			return permission.name == name;
		});
	}

	/**
	 * Add a permission.
	 * @param {IPermission} - The permission's JSON representation to add
	 * @param {object} - options
	 * @returns {Promise<Permission>} - Newly added permission object
	*/
	add(perm: IPermission, opts?: any): Promise<Permission> {
		if ( ! perm) {
			return Promise.reject(new MateriaError(`The information of the permission to be added not found`));
		}
		if (this.permissions.find(permission => permission.name == perm.name)) {
			return Promise.reject(new MateriaError(`The permission ${perm.name} already exists`));
		}

		try {
			this.permissions.push(new Permission(this.app, perm));
		} catch (e) {
			return Promise.reject(e);
		}

		let p = Promise.resolve();

		if ( ! opts) {
			opts = {};
		}

		if (opts.save && perm.file) {
			p = p.then(() => this.app.saveFile(
					path.join(this.app.path, 'server', 'permissions', perm.file, '.js'),
					`module.exports = ${perm.middleware.toString()}`,
					{ mkdir: true }
				).then(() => this.save())
			);
		}
		return p.then(() => this.get(perm.name));
	}

	/**
	 * Update a permission
	 * @param {string} - Name of the permission before update
	 * @param {IPermission} - permission json representation
	 * @param {object} - options
	 * @returns {Promise<Permission>} - Permission object
	*/
	update(name: string, permission: IPermission, opts?: any): Promise<Permission> {
		return new Promise((resolve, reject) => {
			this.permissions.forEach(p => {
				if (p.file && !p.readOnly && name == p.name) {
					p.name = permission.name;
					p.description = permission.description;
					let filepath = p.file;
					filepath = filepath.indexOf(
						path.join(this.app.path, 'server', 'permissions')
					) == -1 ? path.join(
						this.app.path,
						'server',
						'permissions',
						p.file
					) : p.file;
					filepath = filepath.indexOf('.js') !== -1 ? filepath : filepath + '.js';
					if (
						path.join(
							this.app.path,
							'server',
							'permissions',
							permission.file + '.js'
						) !=
						filepath
					) {
						fs.rename(
							filepath,
							path.join(
								this.app.path,
								'server',
								'permissions',
								permission.file + '.js'
							),
							err => {
								if (err) {
									return reject(err);
								}
								p.file = path.join(
									this.app.path,
									'server',
									'permissions',
									permission.file
								);
								p.reload();
								if (opts && opts.save) {
									return this.save().then(() => {
										return resolve(p);
									});
								} else {
									return resolve(p);
								}
							}
						);
					} else {
						p.reload();
						if (opts && opts.save) {
							this.save().then(() => {
								return resolve(p);
							});
						} else {
							return resolve(p);
						}
					}
				}
			});
		});
	}

	/**
	 * Remove a permission
	 * @param {string} - The permission name
	 * @returns {Promise}
	*/
	remove(name, opts?): Promise<void> {
		const permission = this.permissions.find(p => {
			return p.name === name;
		});
		const index = this.permissions.indexOf(permission);
		let filepath = permission.file.indexOf(
			path.join(this.app.path, 'server', 'permissions')
		) == -1 ? path.join(
			this.app.path,
			'server',
			'permissions',
			permission.file
		) : permission.file;
		filepath = filepath.indexOf('.js') !== -1 ? filepath : filepath + '.js';
		if (index != -1) {
			if (opts && opts.removeSource) {
				fs.unlinkSync(filepath);
			}

			this.permissions.splice(index, 1);

			if (opts && opts.save) {
				return this.save();
			}
			return Promise.resolve();
		}
	}

	/**
	 * Save all current permissions as JSON in APP_PATH/server/permissions.json
	*/
	save(): Promise<void> {
		const permissionsToSave: IPermission[] = this.toJson().filter((perm: IPermission) => ! perm.readOnly).map(perm => ({
			name: perm.name,
			description: perm.description,
			file: perm.file
		}));
		return this.app.saveFile(
			path.join(this.app.path, 'server', 'permissions.json'),
			JSON.stringify(permissionsToSave, null, 2),
			{
				mkdir: true
			}
		);
	}

	/**
	 * Get all permissions as JSON representation array
	 * @returns {Array<IPermission>}
	*/
	toJson(): IPermission[] {
		const result = [];
		this.permissions.forEach(permission => {
			result.push(permission.toJson());
		});
		return result;
	}

	private isClass(fn) {
		return (
			typeof fn !== 'function' ||
			fn.toString().startsWith('class') ||
			Boolean(
				fn.prototype &&
					!Object.getOwnPropertyDescriptor(fn, 'prototype').writable // or your fave
			)
		);
	}
}
