import { join, sep } from 'path';
import * as fs from 'fs';
import { IPermission } from '@materia/interfaces';

import { App, Permission } from '../../lib';
import { WebsocketInstance } from '../../lib/websocket';

export class PermissionsLib {
	static list(app: App) {
		return app.api.permissions.toJson();
	}
}

export class PermissionsController {

	constructor(private app: App, websocket: WebsocketInstance) {}

	add(req, res) {
		const newPermission: IPermission = req.body;
		const exists: boolean = this.app.api.permissions.findAll().findIndex(p => p.name === newPermission.name) !== -1;
		if (exists) {
			return res.status(500).send({ error: true, message: `The permission "${newPermission.name}" already exists` });
		}
		let middleware = this._getDefaultMiddleware();
		this.app.watcher.disable();
		this._checkNewPermission(newPermission).then((permissionCode) => {
			if (permissionCode !== '') {
				try {
					const file = join(
						this.app.path,
						'server',
						'permissions',
						newPermission.file
					);
					const rp = require.resolve(file);
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
					// tslint:disable-next-line:no-eval
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
				this.app.watcher.enable();
				res.status(200).json({
					permissions: PermissionsLib.list(this.app),
					selected: newPermission.name
				});
			})
			.catch(err => {
				this.app.watcher.enable();
				res.status(500).send(err.message);
			});
		});
	}

	get(req, res) {
		const name = req.params.permission;
		const permissions = PermissionsLib.list(this.app);
		const permission = permissions.find(p => p.name === name);
		if ( ! permission) {
			return res.status(404).send({ error: true, message: `Permission "${name}" not found` });
		}
		res.status(200).send(permission);
	}

	list(req, res) {
		res.status(200).json(PermissionsLib.list(this.app));
	}

	remove(req, res) {
		const permissionName = req.params.permission;
		const action = req.query.action ? req.query.action : 'confirm and keep';
		const permission = this.app.api.permissions.get(permissionName);
		if ( ! permission) {
			return res.status(404).send({ error: true, message: `Permission "${permissionName}" not found` });
		}
		permission.reload();
		let removeOptions;
		if (action == 'confirm and keep') {
			removeOptions = {
				save: true,
				removeSource: false
			};
		} else if (action == 'confirm and delete') {
			removeOptions = {
				save: true,
				removeSource: true
			};
		}
		this.app.watcher.disable();
		this.app.api.permissions.remove(permissionName, removeOptions).then(() => {
			this.app.watcher.enable();
			res.status(200).send(PermissionsLib.list(this.app));
		}).catch((err) => {
			this.app.watcher.enable();
			res.status(500).send({ error: true, message: err.message });
		});
	}

	update(req, res) {
		const permission: IPermission = req.body;
		const oldName = req.params.permission;
		const oldPermission = this.app.api.permissions.get(oldName);
		if ( ! oldPermission) {
			return res.status(404).send({ error: true, message: `Permission "${oldName}" not found` });
		}
		if (oldPermission.readOnly) {
			return res.status(400).send({ error: true, message: `Unauthorized: permission "${oldName}" is in readonly` });
		}
		this.app.watcher.disable();
		let promise: Promise<any> = Promise.resolve();
		if (
			oldPermission.name !== permission.name ||
			oldPermission.description !== permission.description ||
			oldPermission.file !== permission.file
		) {
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
					this.app.api.put(endpoint.toJson(), endpointIndex, {save: true});
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
			this.app.watcher.enable();
			res.status(200).json({
				permissions: PermissionsLib.list(this.app),
				selected: updatedPermission.name
			});
		}).catch(err => {
			this.app.watcher.enable();
			res.status(500).send(err.message);
		});
	}

	private _checkNewPermission(perm): Promise<string> {
		return new Promise((resolve, reject) => {
			const filepath = join(
				this.app.path,
				'server',
				'permissions',
				`${perm.file}.js`
			);
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
		if (filename.indexOf(sep) == -1) {
			filename = join(
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
