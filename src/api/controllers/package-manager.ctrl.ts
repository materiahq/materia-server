import { App } from '../../lib';
import { WebsocketInstance } from '../../lib/websocket';
import { PackageManager } from '../../lib/package-manager';

export class PackageManagerController {
	packageManager: PackageManager;
	proc: any;

	constructor(private app: App, private websocket: WebsocketInstance) {
		this.packageManager = new PackageManager(this.app.path);
	}

	install(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);

		this.packageManager.install(name, (data, error) => {
			this.app.logger.log(data);
		}).then(data => {
			this.app.watcher.enable();
			return res.status(200).send({data});
		}).catch(err => {
			this.app.watcher.enable();
			return res.status(501).send(err);
		});
	}

	async installAll(req, res) {
		await this._kill(this.proc);
		try {
			const result = await this.packageManager.installAllInBackground();
			this.proc = result.proc;
			res.status(200).send();
		} catch (err) {
			return res.status(500).send(err);
		}
		this.websocket.broadcast({
			type: 'root:install-all:progress',
			data: this.app.path
		});
		this.websocket.broadcast({
			type: 'root:install-all:progress',
			data: `${this.packageManager.managerName === 'yarn' ? '$ yarn install' : '$ npm install'}`
		});
		this.proc.stdout.on('data', d => {
			this.websocket.broadcast({
				type: 'root:install-all:progress',
				data: d.toString()
			});
		});
		this.proc.stderr.on('data', d => {
			this.websocket.broadcast({
				type: 'root:install-all:progress',
				data: d.toString()
			});
		});

		this.proc.on('close', (code, signal) => {
			if (code) {
				this.websocket.broadcast({
					type: 'root:install-all:fail',
					data: code + signal
				});
			} else {
				this.websocket.broadcast({
					type: 'root:install-all:success'
				});
			}
		});
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

	private getPkgFromRequest(req) {
		let pkg = req.params.dependency;
		if (req.params[0]) {
			pkg += req.params[0];
		}
		return pkg;
	}

	private _kill(stream): Promise<void> {
		if ( ! stream) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const isWin = /^win/.test(process.platform);
			if (!isWin) {
				stream.kill('SIGINT');
				return resolve();
			} else {
				const cp = require('child_process');
				cp.exec('taskkill /PID ' + stream.pid + ' /T /F', (error, stdout, stderr) => { return resolve(); });
			}
		});
	}
}
