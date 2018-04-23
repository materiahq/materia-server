import { App } from "../../lib";

import * as npm from 'npm';
import * as fs from 'fs';
import * as path from 'path';

export class PackageManagerController {
	constructor(private app: App) {}

	install(req, res) {
		const name = req.params.name;
		console.log(`(Dependency) Install ${name}`);
		return this.npmCall('install', [name]).then(data => {
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
	upgrade(req, res) {
		const name = req.params.name
		console.log(`(Dependency) Install ${name}`);
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

	installAll(req, res) {
		return this.npmCall('install', []).then(data => {
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	uninstall(req, res) {
		const name = req.params.name
		console.log(`(Addons) Uninstall ${name}`);
		this.npmCall('uninstall', [name]).then(data => {
			const pkg = this.getPkg();
			if (!pkg['dependencies']) {
				pkg['dependencies'] = {};
			}
			delete pkg['dependencies'][name];

			this.savePkg(pkg);
			res.status(200).send(data);
		}).catch(e => {
			res.status(500).json(e);
		});
	}

	runScript(req, res) {}
	runBin(req, res) {}

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
