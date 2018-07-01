import { App } from "../../lib";

import { WebsocketInstance } from "../../lib/websocket";
import { Npm } from "../lib/npm";

export class PackageManagerController {
	npm: Npm;

	constructor(app: App, websocket: WebsocketInstance) {}

	installcp(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		console.log(`(Dependency) Install ${name}`);
		this.npm.exec('install', [name, '--save']).then(data => {
			res.status(200).send(data);
		}).catch(err => {
			res.status(500).send(err);
		})
	}

	upgradecp(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		return this.npm.exec('upgrade', [name, '--save']).then(data => {
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).send(e);
		});
	}

	installAllcp(req, res) {
		return this.npm.exec('install', []).then(data => {
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).send(e);
		});
	}
	uninstallcp(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;
		this.npm.exec('uninstall', [name, '--save']).then(data => {
			res.status(200).send(data)
		}).catch(err => res.status(500).send(err));
	}
}
