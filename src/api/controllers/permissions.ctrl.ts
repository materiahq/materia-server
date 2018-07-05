import { App } from '../../lib';

import * as path from 'path';
import { WebsocketInstance } from '../../lib/websocket';

export class PermissionsController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	initCreate(req, res) {
		const perm = req.body;

		this.app.api.permissions
			.add(
				{
					name: perm.name,
					description: perm.description,
					middleware: (req, res, next) => {
	next();
},
					file: perm.file
				},
				{ save: true }
			)
			.then(result => {
				const reloadPerm = this.app.api.permissions
					.get(perm.name);

				if (reloadPerm) {
					reloadPerm.reload();
				}

				res.status(200).json({
					permissions: PermissionsLib.list(this.app),
					selected: perm.name
				});
			})
			.catch(err => res.status(500).json(err));
	}

	update(req, res) { // payload: { permission: IPermission; oldName: string }) {
		const perm = req.body;
		const oldName = req.params.permission;
		return this.app.api.permissions
			.update(
				oldName,
				{
					name: perm.name,
					description: perm.description,
					file: perm.file
				},
				{ save: true }
			)
			.then(result => {
				const reloadPerm = this.app.api.permissions.get(perm.name);
				reloadPerm.reload();
				res.status(200).json({
					permissions: PermissionsLib.list(this.app),
					selected: perm.name
				});
			})
			.catch(err => res.status(500).json(err));
	}

	remove(req, res) { // payload: { permission: IPermission; action: string }) {
		const perm = req.params.permission;
		const action = req.query.action;
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

	save(req, res) {
		const perm = this.app.api.permissions.get(req.body.name)
			? this.app.api.permissions.get(req.body.name)
			: req.body;
		let filename = perm.file;
		if (filename.indexOf(path.sep) == -1) {
			filename = path.join(
				this.app.path,
				'server',
				'permissions',
				perm.file
			);
		}
		if (filename.indexOf('.js') == -1) {
			filename = filename + '.js';
		}

		if (!perm) {
			return res.status(500).json(new Error('Impossible to save: no permission selected'));
		}
		if (perm.readOnly) {
			return res.status(500).json(new Error('Impossible to save: permission is in readonly'));
		}

		return this.app
			.saveFile(filename, req.body.code, {
				mkdir: true
			})
			.then(() => {
				const reloadPerm = this.app.api.permissions.get(perm.name);
				if (reloadPerm) {
					reloadPerm.reload();
				}
				res.status(200).json(PermissionsLib.list(this.app));
			})
			.catch(err => {
				res.status(500).json(err);
			});
	}

	list(req, res) {
		res.status(200).json(PermissionsLib.list(this.app));
	}
}

export class PermissionsLib {
	static list(app: App) {
		return app.api.permissions.findAll().map(permission => {
			return Object.assign({}, permission.toJson(), {
				code: `module.exports = ${permission.middleware.toString()}`
			});
		});
	}
}
