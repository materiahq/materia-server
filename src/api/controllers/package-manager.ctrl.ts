import { App } from "../../lib";

import { WebsocketInstance } from "../../lib/websocket";
import { Npm } from "../lib/npm";

export class PackageManagerController {
	npm: Npm;

	constructor(private app: App, websocket: WebsocketInstance) {
		this.npm = new Npm(app.path);
		this.npm.enableLogger(this.app);
	}

	install(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;
		this.app.watcher.disable()

		console.log(`(Dependency) Install ${name}`);
		try {
			this.npm.exec('install', [name, '--save'], (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable()
				return res.status(200).send({data});
			}).catch(err => {
				this.app.watcher.enable()
				return res.status(501).send(err);
			})
		} catch(e) {
			this.app.watcher.enable()
			return res.status(502).send(e);
		}
	}

	upgrade(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		return this.npm.exec('upgrade', [name, '--save']).then(data => {
			res.status(200).send({data});
		}).catch(e => {
			res.status(500).send(e);
		});
	}

	installAll(req, res) {
		return this.npm.exec('install', [], (data, error) => {
			this.app.logger.log(data);
		}).then(data => {
			res.status(200).send({data});
		}).catch(e => {
			res.status(500).send(e);
		});
	}

	uninstall(req, res) {
		this.app.watcher.disable();
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		console.log(`(Dependency) Uninstall ${name}`);
		try {
			this.npm.exec('uninstall', [name, '--save'], (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable()
				return res.status(200).send({data})
			}).catch(err => {
				this.app.watcher.enable()
				return res.status(501).send(err)
			});
		} catch(e) {
			this.app.watcher.enable()
			return res.status(502).send(e);
		}
	}
}
