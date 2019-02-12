import { App } from './app';

const npm = require('npm');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

export class Npm {
	npm: any;
	cwd: string;

	constructor(private app: App) {}

	npmCall(command: string, params?: string[]): Promise<any> {
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

	_buffer(proc) {
		return new Promise((resolve, reject) => {
			let output = '';
			proc.stdout.on('data', data => {
				console.log(`stdout: ${data}`);
				output += data;
			});
			proc.stderr.on('data', data => {
				console.log(`stderr: ${data}`);
				output += data;
			});
			proc.on('close', code => {
				console.log(`npm exited with code ${code}`);
				if (code == 0) {
					return resolve(output);
				}
				return reject({
					code: code,
					data: output
				});
			});
		});
	}

	spawn(
		args,
		options: {
			bufferized?: boolean;
			cwd?: string;
		} = {}
	) {
		const appPath = this.app.path;

		const npmPath = path.join(
			__dirname,
			'node_modules',
			'npm',
			'bin',
			`npm-cli.js`
		);
		const proc = cp.fork(npmPath, args, {
			cwd: options.cwd || appPath,
			silent: true
		});
		if (options.bufferized) {
			return this._buffer(proc);
		} else {
			return proc;
		}
	}

	spawnNpx(args, bufferized?) {
		const cwd = this.app.path;

		const npmPath = path.join(
			__dirname,
			'node_modules',
			'npm',
			'bin',
			`npx-cli.js`
		);
		const proc = cp.fork(npmPath, args, {
			cwd: cwd,
			silent: true
		});
		if (bufferized) {
			return this._buffer(proc);
		} else {
			return proc;
		}
	}

	getPkg(mod?) {
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

	getPackageJson(mod?: string) {
		const cwd = this.app.path;

		return new Promise((resolve, reject) => {
			let p;
			if (mod) {
				p = path.join(cwd, 'node_modules', mod, 'package.json');
			} else {
				p = path.join(cwd, 'package.json');
			}
			fs.readFile(p, 'utf-8', (e, data) => {
				if (e) {
					reject(e);
				} else {
					resolve(JSON.parse(data));
				}
			});
		});
	}

	savePkg(pkg) {
		const cwd = this.app.path;

		const p = path.join(cwd, 'package.json');
		const data = JSON.stringify(pkg, null, 2);
		fs.writeFileSync(p, data);
	}

	install(name) {
		console.log(`(Addons) Install ${name}`);
		return this.npmCall('install', [name]).then(data => {
			const pkg = this.getPkg();
			if (!pkg['dependencies']) {
				pkg['dependencies'] = {};
			}
			const tmp = this.getPkg(name);
			pkg['dependencies'][name] = `~${tmp['version']}`;
			this.savePkg(pkg);
			return true;
		});
	}

	upgrade(name: string, version?: string) {
		const npmName = version ? `${name}@${version}` : name;
		console.log(`(Addons) Install ${npmName}`);
		return this.npmCall('upgrade', [npmName]).then(data => {
			const pkg = this.getPkg();
			if (!pkg['dependencies']) {
				pkg['dependencies'] = {};
			}
			const tmp = this.getPkg(name);
			pkg['dependencies'][name] = `~${tmp['version']}`;
			this.savePkg(pkg);
			return true;
		});
	}

	installAll() {
		console.log(`(Addons) Install all dependencies`);
		return this.npmCall('install', []);
	}

	remove(name) {
		console.log(`(Addons) Uninstall ${name}`);
		return this.npmCall('uninstall', [name]).then(data => {
			const pkg = this.getPkg();
			if (!pkg['dependencies']) {
				pkg['dependencies'] = {};
			}
			delete pkg['dependencies'][name];

			this.savePkg(pkg);
			return true;
		});
	}
}
