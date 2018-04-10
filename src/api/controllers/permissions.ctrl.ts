import { App } from '../../lib';

import {
	IPermission,
	IEndpoint,
	IEntity,
	IQuery,
	IParam
} from '@materia/interfaces';

import * as fs from 'fs';
import * as path from 'path';

export class PermissionsController {
	constructor(private app: App) {}

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
					file: perm.name
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
					file: perm.name
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
		const reloadPerm = this.app.api.permissions
			.findAll()
			.get(perm);

		if (reloadPerm) {
			reloadPerm.reload();
		}

		if (action == 'confirm and keep') {
			this.app.api.permissions.remove(perm.name, {
				save: true,
				removeSource: false
			});
		} else if (action == 'confirm and delete') {
			this.app.api.permissions.remove(perm.name, {
				save: true,
				removeSource: true
			});
		}
		res.status(200).json(PermissionsLib.list(this.app));
	}

	save(req, res) {
		const perm = this.app.api.permissions.get(req.params.permission);

		if (perm.file.indexOf(path.sep) == -1) {
			perm.file = path.join(
				this.app.path,
				'server',
				'permissions',
				perm.file
			);
		}
		if (perm.file.indexOf('.js') == -1) {
			perm.file = perm.file + '.js';
		}

		if (!perm) {
			return res.status(500).json(new Error('Impossible to save: no permission selected'));
		}
		if (perm.readOnly) {
			return res.status(500).json(new Error('Impossible to save: permission is in readonly'));
		}

		return this.app
			.saveFile(perm.file, perm.code, {
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
				code: `module.exports = ${permission.middleware.toString()}`,
				file: permission.file
			});
		});
	}
}
