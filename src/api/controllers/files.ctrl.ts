import { Application as ExpressApplication } from 'express';
import { App } from "../../lib";
import { OAuth } from '../oauth';

import * as fs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';

export class FilesController {

	get api(): ExpressApplication { return this.app.server.expressApp; }

	constructor(private app: App) {
	}

	read(req, res) {
		let p = this.app.path;
		if (req.query.path) {
			if (req.query.path.includes(this.app.path)) {
				p = req.query.path;
			} else {
				p = path.join(this.app.path, req.query.path);
			}
		}
		console.log('read', p, fse.existsSync(p), fse.lstatSync(p).isDirectory())
		if (req.query.path && fse.existsSync(p)) {
			if (fse.lstatSync(p).isDirectory()) {
				const splittedName = p.split('/');
				const length = splittedName.length;
				const filename = splittedName[length - 1];
				res.send(200, this.app.getFiles(req.query.depth, filename, path.join(...splittedName)))
			}
			else {
				res.send(200, this.app.readFile(p))
			}
		} else {
			res.send(200, this.app.getFiles(req.query.depth || 1))
		}
	}

	write(req, res) {
		console.log(req.body.isDir, typeof req.body.isDir);
		if (req.body.isDir) {
			fse.mkdirSync(req.body.path);
			res.status(201).json({ saved: true })
		} else {
			this.app.saveFile(path.join(this.app.path, req.body.path), req.body.content, {
				mkdir: true
			});
			res.status(201).json({ saved: true })
		}
	}

	move(req, res) {
		const filePath = req.body.path;
		const newPath = req.body.newPath;

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
		const p = req.query.path;

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
		fse.removeSync(req.query.path);
		res.status(200).json({ removed: true });
	}
}