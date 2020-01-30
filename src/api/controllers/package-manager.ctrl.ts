import { App } from '../../lib';
import { WebsocketInstance } from '../../lib/websocket';
import { PackageManager } from '../../lib/package-manager';

export class PackageManagerController {
	packageManager: PackageManager;
	proc: any;

	constructor(private app: App, private websocket: WebsocketInstance) {
		this.packageManager = new PackageManager(this.app.path);
	}

	async install(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);
		const version = req.body && req.body.version ? req.body.version : 'latest';

		try {
			await this.packageManager.install(`${name}@${version}`, (data, error) => {
				this.app.logger.log(data);
			});
			const deps = await this.packageManager.getDependencies();
			const resolved = await this.packageManager.getVersion(name);
			this.app.watcher.enable();
			res.status(200).send({name: name, version: deps[name], type: 'prod', resolved });
		} catch (e) {
			this.app.watcher.enable();
			return res.status(500).send(e);
		}
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

	async upgrade(req, res) {
		this.app.watcher.disable();
		const name = this.getPkgFromRequest(req);
		const version = req.body && req.body.version ? req.body.version : 'latest';

		try {
			await this.packageManager.upgrade(`${name}@${version}`, (data, error) => {
				this.app.logger.log(data);
			});
			const deps = await this.packageManager.getDependencies();
			const resolved = await this.packageManager.getVersion(name);
			this.app.watcher.enable();
			res.status(200).send({name: name, version: deps[name], type: 'prod', resolved });
		} catch (e) {
			this.app.watcher.enable();
			return res.status(500).send(e);
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
