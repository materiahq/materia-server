import { App } from "../../lib";
import { Npm } from "../lib/npm";
import { WebsocketInstance } from "../../lib/websocket";

export class PackageManagerController {
	npm: Npm;

	constructor(private app: App, websocket: WebsocketInstance) {
		this.npm = new Npm(app.path);
		this.npm.enableLogger(this.app);
	}

	install(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);

		try {
			this.npm.exec('install', [name, '--save'], null, (data, error) => {
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
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);

		try {
			this.npm.exec('upgrade', [name, '--save'], null, (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable();
				return res.status(200).send({data});
			}).catch(e => {
				this.app.watcher.enable();
				return res.status(500).send(e);
			});
		} catch(e) {
			this.app.watcher.enable();
			return res.status(502).send(e);
		}
	}

	installAll(req, res) {
		this.app.watcher.disable();
		try {
			this.npm.exec('install', [], null, (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable();
				return res.status(200).send({data});
			}).catch(e => {
				this.app.watcher.enable();
				return res.status(500).send(e);
			});
		} catch(e) {
			this.app.watcher.enable();
			return res.status(502).send(e);
		}
	}

	uninstall(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);

		try {
			this.npm.exec('uninstall', [name, '--save'], null, (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable();
				return res.status(200).send({data});
			}).catch(err => {
				this.app.watcher.enable();
				return res.status(501).send(err);
			});
		} catch(e) {
			this.app.watcher.enable();
			return res.status(502).send(e);
		}
	}

	private getPkgFromRequest(req) {
		let pkg = req.params.pkg;
		if (req.params[0]) {
			pkg += req.params[0];
		}
		return pkg;
	}
}
