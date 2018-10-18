import { Application as ExpressApplication } from 'express';
import { App } from "../../lib";

import * as path from 'path';
import * as fse from 'fs-extra';
import { WebsocketInstance } from '../../lib/websocket';

export class FilesController {

	get api(): ExpressApplication { return this.app.server.expressApp; }

	constructor(private app: App, websocket: WebsocketInstance) {
	}

	getFullPath(relativePath) {
		let p = this.app.path;
		if (relativePath && relativePath !== '/') {
			if (relativePath.includes(this.app.path)) {
				p = relativePath;
			} else {
				p = path.join(this.app.path, relativePath);
			}
		}
		return p;
	}

	read(req, res) {
		const p = this.getFullPath(req.query.path);
		if (req.query.path && fse.existsSync(p)) {
			if (fse.lstatSync(p).isDirectory()) {
				const splittedName = p.split(path.sep);
				const length = splittedName.length;
				const filename = splittedName[length - 1];
				const files = this.app.getFiles(req.query.depth || 1, filename, p);
				res.status(200).send(files);
			}
			else {
				res.status(200).send(this.app.readFile(p))
			}
		} else {
			const files = this.app.getFiles(req.query.depth || 1)
			res.status(200).send(files);
		}
	}

	write(req, res) {
		const p = this.getFullPath(req.query.path);

		if (req.body.isDir) {
			fse.mkdirSync(p);
			res.status(201).json({ saved: true })
		} else {
			this.app.saveFile(p, req.body.content, {
				mkdir: true
			});
			res.status(201).json({ saved: true })
		}
	}

	move(req, res) {
		const filePath = this.getFullPath(req.query.path);
		const newPath = this.getFullPath(req.body.newPath);

		fse.move(
			filePath,
			newPath,
			{ clobber: true },
			err => {
				if (err) {
					return res.status(500).json(err);
				}
				res.status(200).json({ moved: true });
			}
		);
	}

	isDirectory(req, res) {
		const p = this.getFullPath(req.query.path);

		if (
			fse.existsSync(p) &&
			fse.lstatSync(p).isDirectory()
		) {
			res.status(200).json(true);
		} else {
			res.status(200).json(false);
		}
	}

	remove(req, res) {
		fse.remove(
			this.getFullPath(req.query.path),
			(err) => {
				if (err) {
					res.status(500).send(err);
				} else {
					res.status(200).json({ removed: true });
				}
			}
		);
	}
}