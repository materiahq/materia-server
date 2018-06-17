import { App } from "../../lib";

import * as npm from 'npm';
import * as fs from 'fs';
import * as path from 'path';
import * as execa from 'execa';
import { WebsocketInstance } from "../../lib/websocket";

export class PackageManagerController {
	constructor(private app: App, websocket: WebsocketInstance) {}

	installcp(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		console.log(`(Dependency) Install ${name}`);
		this.npm('install', [name, '--save']).then(data => {
			res.status(200).json(data);
		}).catch(err => {
			res.status(500).json(err);
		})
	}

	install(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		console.log(`(Dependency) Install ${name}`);

		const cmd = req.query.dev ? 'link' : 'install';

		return this.npmCall(cmd, [name]).then(data => {
			const pkg = this.getPkg();
			if (!pkg['dependencies']) {
				pkg['dependencies'] = {};
			}
			const tmp = this.getPkg(name);
			pkg['dependencies'][name] = `~${tmp['version']}`;
			this.savePkg(pkg);
			res.status(200).json(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	upgrade(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		console.log(`(Dependency) Upgrade ${name}`);
		return this.npmCall('upgrade', [name]).then(data => {
			const pkg = this.getPkg();
			if (!pkg['dependencies']) {
				pkg['dependencies'] = {};
			}
			const tmp = this.getPkg(name);
			pkg['dependencies'][name] = `~${tmp['version']}`;
			this.savePkg(pkg);
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	upgradecp(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;

		return this.npm('upgrade', [name, '--save']).then(data => {
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	installAll(req, res) {
		return this.npmCall('install', []).then(data => {
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	installAllcp(req, res) {
		return this.npm('install', []).then(data => {
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}
	uninstallcp(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;
		this.npm('uninstall', [name, '--save']).then(data => {
			res.status(200).json(data)
		}).catch(err => res.status(500).json(err));
	}

	uninstall(req, res) {
		const name = req.params.owner
			? `${req.params.owner}/${req.params.dependency}`
			: req.params.dependency;
		console.log(`(Addons) Uninstall ${name}`);
		this.npmCall('uninstall', [name]).then(data => {
			const pkg = this.getPkg();
			if (!pkg['dependencies']) {
				pkg['dependencies'] = {};
			}
			delete pkg['dependencies'][name];

			this.savePkg(pkg);
			res.status(200).json(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	runScript(req, res) {}
	runBin(req, res) {}

	private npm(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			// const cwd = this.app.path;
			console.log("DIRNAME", __dirname);

			let data = '';
			const stream = execa(path.resolve(`node_modules/.bin/npm`), [command, ...params], {
				cwd: this.app.path
			});
			stream.stdout.on('data', d => {
				console.log(`stdout: ${d}`);
				data += d;
			});
			stream.stderr.on('data', (d) => {
				console.log(`stderr: ${d}`);
				data += d;
			});

			stream.on('close', (code) => {
				console.log(`child process exited with code ${code}`);
				if (code == 0) {
					return resolve(data);
				} else {
					return reject({
						code,
						data
					});
				}
			});
		});
	}

	private npmCall(command: string, params?: string[]): Promise<any> {
		const cwd = this.app.path;
		return new Promise((resolve, reject) => {
			npm.load(
				{
					prefix: cwd,
					loglevel: 'error',
					loaded: false,
					save: true
				},
				err => {
					if (err) {
						console.log(` └─ Fail: ${err}`);
						return reject(err);
					}
					console.log(` └─ Run: npm ${command} ${params.join(' ')}`);
					npm.commands[command](params, (e, data) => {
						if (e) {
							console.log(` └─ Fail: ${e}`);
							return reject(e);
						}
						console.log(` └─ Done: ${data}`);
						return resolve(data);
					});
				}
			);
		});
	}

	private getPkg(mod?) {
		const cwd = this.app.path;

		let p;
		if (mod) {
			p = path.join(cwd, 'node_modules', mod, 'package.json');
		} else {
			p = path.join(cwd, 'package.json');
		}
		const packageJsonPath = require.resolve(p);
		if (require.cache[packageJsonPath]) {
			delete require.cache[packageJsonPath];
		}
		const pkg = require(p);
		return pkg;
	}

	private savePkg(pkg) {
		const cwd = this.app.path;

		const p = path.join(cwd, 'package.json');
		const data = JSON.stringify(pkg, null, 2);
		fs.writeFileSync(p, data);
	}
}
