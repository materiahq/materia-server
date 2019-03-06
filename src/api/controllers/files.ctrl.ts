import { Application as ExpressApplication } from 'express';
import { join, basename } from 'path';
import * as fse from 'fs-extra';

import { App } from '../../lib';
import { WebsocketInstance } from '../../lib/websocket';

export class FilesController {

	get api(): ExpressApplication { return this.app.server.expressApp; }

	constructor(private app: App, websocket: WebsocketInstance) {}

	getFullPath(relativePath) {
		let p = this.app.path;
		if (relativePath && relativePath !== '/') {
			if (relativePath.includes(this.app.path)) {
				p = relativePath;
			} else {
				p = join(this.app.path, relativePath);
			}
		}
		return process.platform !== 'win32' ? p.replace(/\\/g, '/') : p;
	}

	read(req, res) {
		if (req.query.path) {
			const p = this.getFullPath(req.query.path);
			if (fse.existsSync(p)) {
				if (fse.lstatSync(p).isDirectory()) {
					const files = this.app.getFiles(
						req.query.depth || 1,
						basename(p),
						p
					);
					res.status(200).send(files);
				} else {
					res.status(200).send(this.app.readFile(p));
				}
			} else {
				res.status(404).send({
					error: true,
					message: 'No such file or directory'
				});
			}
		} else {
			const files = this.app.getFiles(req.query.depth || 1);
			res.status(200).send(files);
		}
	}

	write(req, res) {
		const path = this.getFullPath(req.query.path);
		let p = Promise.resolve();
		if (req.body.isDir) {
			p = p.then(() => fse.mkdir(path));
		} else {
			p = p.then(() =>
				this.app.saveFile(path, req.body.content, {
					mkdir: true
				})
			);
		}
		p.then(() => {
			const isDir = fse.lstatSync(path).isDirectory();
			const result = isDir ? this.app.getFiles(
				1,
				basename(path),
				path
			) : this.app.getFile(path);
			res.status(201).send(result);
		}).catch(err => {
			res.status(500).send({error: true, message: err.message});
		});
	}

	move(req, res) {
		const filePath = this.getFullPath(req.query.path);
		const newPath = this.getFullPath(req.body.newPath);

		fse.move(filePath, newPath, { overwrite: true }, err => {
			if (err) {
				return res.status(500).json(err);
			}
			const isDir = fse.lstatSync(newPath).isDirectory();
			const result = isDir ? this.app.getFiles(
				1,
				basename(newPath),
				newPath
			) : this.app.getFile(newPath);
			res.status(200).send(result);
		});
	}

	isDirectory(req, res) {
		const p = this.getFullPath(req.query.path);

		if (fse.existsSync(p) && fse.lstatSync(p).isDirectory()) {
			res.status(200).json(true);
		} else {
			res.status(200).json(false);
		}
	}

	remove(req, res) {
		fse.remove(this.getFullPath(req.query.path), err => {
			if (err) {
				res.status(500).send(err);
			} else {
				res.status(200).json({ removed: true });
			}
		});
	}
}
