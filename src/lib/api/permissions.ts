import * as fs from 'fs';
import * as path from 'path';

import { App } from '../app';
import { MateriaError } from '../error';
import { IPermission, Permission } from './permission';

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

			let rev_permissions = permissionsName.reverse();

			rev_permissions.every(permissionName => {
				let permission = this.permissions.find(
					permission => permission.name == permissionName
				);

				if (!permission) {
					const err: any = new MateriaError(
						'Could not find permission "' + permissionName + '"'
					)
					res.status(500).json(err.message);
					next(err.message)
					return false;
				}

				let nextchain = chain;
				chain = (req, res, next) => {
					let _next = e => {
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
			let results = [];
			permissionsRaw.forEach(permissionRaw => {
				let obj = this.loadPermission(permissionRaw);
				results.push(this.add(obj));
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
	 * @returns {Permission} - Newly added permission object
	*/
	add(perm: IPermission, opts?: any): Promise<Permission> {
		if (!perm) {
			return Promise.reject(new MateriaError(`The information of the permission to be added not found`));
		}
		if (!opts) {
			opts = {};
		}
		if (
			this.permissions.find(permission => {
				return permission.name == perm.name;
			})
		) {
			return Promise.reject(
				new MateriaError(`The permission ${perm.name} already exists`)
			);
		}

		try {
			this.permissions.push(new Permission(this.app, perm));

			if (opts.save && perm.file) {
				return this.app
					.saveFile(
						path.join(
							this.app.path,
							'server',
							'permissions',
							perm.file + '.js'
						),
						`module.exports = ${perm.middleware.toString()}`,
						{
							mkdir: true
						}
					)
					.then(() => {
						return this.save();
					})
					.then(() => {
						return Promise.resolve(this.get(perm.name));
					});
			} else {
				return Promise.resolve(this.get(perm.name));
			}
		} catch (e) {
			return Promise.reject(e);
		}
	}

	/**
	 * Update a permission
	 * @param {string} - Name of the permission before update
	 * @param {IPermission} - permission json representation
	 * @param {object} - options
	 * @returns {Permission} - Permission object
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
	*/
	remove(name, opts?): Promise<void> {
		let permission = this.permissions.find(permission => {
			return permission.name == name;
		});
		let index = this.permissions.indexOf(permission);
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
			} else return Promise.resolve();
		}
	}

	/**
	 * Save all current permissions as JSON in APP_PATH/server/permissions.json
	*/
	save(): Promise<void> {
		return this.app.saveFile(
			path.join(this.app.path, 'server', 'permissions.json'),
			JSON.stringify(this.toJson(), null, 2),
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
		let result = [];
		this.permissions.forEach(permission => {
			let json = permission.toJson();
			if (!json.readOnly) {
				delete json.readOnly;
				result.push(json);
			}
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

	private loadPermission(permission): IPermission {
		if (!permission.file) {
			return null;
		}
		let permissionPath = path.join(
			this.app.path,
			'server',
			'permissions',
			permission.file
		);
		try {

			const rp = require.resolve(permissionPath);
			if (require.cache[rp]) {
				delete require.cache[rp];
			}
			const middleware = require(permissionPath);
			return {
				name: permission.name,
				description: permission.description,
				middleware: middleware,
				file: permissionPath
			};
		}
		catch (e) {
			return {
				name: permission.name,
				description: permission.description,
				middleware: fs.readFileSync(permissionPath + '.js', 'utf8'),
				invalid: true,
				file: permissionPath
			};
		}
	}
}
