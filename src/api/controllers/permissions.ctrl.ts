import * as path from 'path';
import * as fs from 'fs';

import { App, Permission } from '../../lib';
import { WebsocketInstance } from '../../lib/websocket';
import { IPermission } from '@materia/interfaces';

export class PermissionsController {

	constructor(private app: App, websocket: WebsocketInstance) {}

	add(req, res) {
		const newPermission: IPermission = req.body;
		const exists: boolean = this.app.api.permissions.findAll().findIndex(p => p.name === newPermission.name) !== -1;
		if ( ! exists) {
			let middleware = this._getDefaultMiddleware();
			this._checkNewPermission(newPermission).then((permissionCode) => {
				if (permissionCode !== '') {
					try {
						let file = path.join(
							this.app.path,
							'server',
							'permissions',
							newPermission.file
						);
						let rp = require.resolve(file);
						if (require.cache[rp]) {
							delete require.cache[rp];
						}
						middleware = require(file);
					} catch (err) {}
				}

				this.app.api.permissions.add(
					{
						name: newPermission.name,
						description: newPermission.description,
						middleware: newPermission.code ? eval(newPermission.code) : middleware,
						file: newPermission.file
					},
					{ save: true }
				)
				.then((result) => {
					const reloadPerm = this.app.api.permissions
						.get(newPermission.name);

					if (reloadPerm) {
						reloadPerm.reload();
					}

					res.status(200).json({
						permissions: PermissionsLib.list(this.app),
						selected: newPermission.name
					});
				})
				.catch(err => res.status(500).send(err.message))
			});
		} else {
			res.status(500).send(`The permission "${newPermission.name}" already exists`);
		}
	}

	get(req, res) {
		const name = req.params.permission;
		const permissions = PermissionsLib.list(this.app);
		const permission = permissions.find(p => p.name === name);
		if (permission) {
			res.status(200).send(permission);
		} else {
			res.status(500).send(`Permission with name '${name}' not found`);
		}
	}

	list(req, res) {
		res.status(200).json(PermissionsLib.list(this.app));
	}

	remove(req, res) {
		const perm = req.params.permission;
		const action = req.query.action ? req.query.action : 'confirm and keep';
		const reloadPerm = this.app.api.permissions.get(perm);
		if (reloadPerm) {
			reloadPerm.reload();
		}
		if (action == 'confirm and keep') {
			this.app.api.permissions.remove(perm, {
				save: true,
				removeSource: false
			});
		} else if (action == 'confirm and delete') {
			this.app.api.permissions.remove(perm, {
				save: true,
				removeSource: true
			});
		}
		res.status(200).json(PermissionsLib.list(this.app));
	}

	update(req, res) {
		const permission : IPermission = req.body;
		const oldName = req.params.permission;
		const oldPermission = this.app.api.permissions.get(oldName);
		if ( ! oldPermission) {
			return res.status(500).send('Impossible to update: no permission selected');
		}
		if (oldPermission.readOnly) {
			return res.status(500).send('Impossible to update: permission is in readonly');
		}
		let promise = Promise.resolve();
		if (oldPermission.name !== permission.name || oldPermission.description !== permission.description || oldPermission.file !== permission.file) {
			promise = promise.then(() => this.app.api.permissions
			.update(
				oldName,
				{
					name: permission.name,
					description: permission.description,
					file: permission.file
				},
				{ save: true }
			));
		}
		if (oldPermission.name !== permission.name) {
			const endpointsToEdit = this.app.api.endpoints.filter((endpoint) => {
				if (endpoint.permissions && endpoint.permissions.indexOf(oldPermission.name) !== -1) {
					return true;
				}
				return false;
			});
			if (endpointsToEdit && endpointsToEdit.length) {
				endpointsToEdit.forEach((endpoint) => {
					const index = endpoint.permissions.indexOf(oldPermission.name);
					endpoint.permissions[index] = permission.name;
					const endpointIndex = this.app.api.endpoints.findIndex(e => e.method + e.url === endpoint.method + endpoint.url);
					this.app.api.put(endpoint, endpointIndex, {save: true});
				});
				this.app.api.updateEndpoints();
			}
		}
		if (permission.code) {
			const filename = this._getPermissionFilepath(this.app.api.permissions.get(permission.name));
			promise = promise.then(() => this.app.saveFile(filename, permission.code, {
				mkdir: true
			}));
		}
		return promise.then(() => {
			const updatedPermission = this.app.api.permissions.get(permission.name);
			updatedPermission.reload();
			res.status(200).json({
				permissions: PermissionsLib.list(this.app),
				selected: updatedPermission.name
			});
		}).catch(err => res.status(500).send(err.message));;
	}

	private _checkNewPermission(perm): Promise<string> {
		return new Promise((resolve, reject) => {
			const filepath = path.join(
				this.app.path,
				'server',
				'permissions',
				perm.file + '.js'
			)
			fs.stat(filepath, (err, stats) => {
				// Check if error defined and the error code is "not exists"
				if (err && err.code === 'ENOENT') {
					return resolve('');
				}
				return resolve(fs.readFileSync(filepath, 'utf-8'));
			});
		});
	}

	private _getDefaultMiddleware() {
		return (req, res, next) => {
			next();
		};
	}

	private _getPermissionFilepath(permission: Permission) {
		let filename = permission.file;
		if (filename.indexOf(path.sep) == -1) {
			filename = path.join(
				this.app.path,
				'server',
				'permissions',
				permission.file
			);
		}
		if (filename.indexOf('.js') == -1) {
			filename = filename + '.js';
		}
		return filename;
	}
}

export class PermissionsLib {
	static list(app: App) {
		return app.api.permissions.toJson();
	}
}
