import { App } from '../../lib';
import { WebsocketInstance } from '../../lib/websocket';
import { PackageManager } from '../../lib/package-manager';

export class PackageManagerController {
	packageManager: PackageManager;

	constructor(private app: App, websocket: WebsocketInstance) {
		this.packageManager = new PackageManager(this.app.path);
	}

	install(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);

		try {
			this.packageManager.install(name, (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable();
				return res.status(200).send({data});
			}).catch(err => {
				this.app.watcher.enable();
				return res.status(501).send(err);
			});
		} catch (e) {
			this.app.watcher.enable();
			return res.status(502).send(e);
		}
	}

	upgrade(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);

		try {
			this.packageManager.upgrade(name, (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable();
				return res.status(200).send({data});
			}).catch(e => {
				this.app.watcher.enable();
				return res.status(500).send(e);
			});
		} catch (e) {
			this.app.watcher.enable();
			return res.status(502).send(e);
		}
	}

	installAll(req, res) {
		this.app.watcher.disable();
		try {
			this.packageManager.installAll((data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable();
				return res.status(200).send({data});
			}).catch(e => {
				this.app.watcher.enable();
				return res.status(500).send(e);
			});
		} catch (e) {
			this.app.watcher.enable();
			return res.status(502).send(e);
		}
	}

	uninstall(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);

		try {
			this.packageManager.uninstall(name, (data, error) => {
				this.app.logger.log(data);
			}).then(data => {
				this.app.watcher.enable();
				return res.status(200).send({data});
			}).catch(err => {
				this.app.watcher.enable();
				return res.status(501).send(err);
			});
		} catch (e) {
			this.app.watcher.enable();
			return res.status(502).send(e);
		}
	}

	private getPkgFromRequest(req) {
		let pkg = req.params.dependency;
		if (req.params[0]) {
			pkg += req.params[0];
		}
		return pkg;
	}
}
