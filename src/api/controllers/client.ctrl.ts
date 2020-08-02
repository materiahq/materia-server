import chalk = require('chalk');
import { join } from 'path';
import { IClientConfig } from '@materia/interfaces';

import { App, ConfigType } from '../../lib';
import { WebsocketInstance } from '../../lib/websocket';
import { PackageManager } from '../../lib/package-manager';

export class ClientController {
	packageManager: PackageManager;
	proc: any;


	constructor(private app: App, private websocket: WebsocketInstance) {
		this.packageManager = new PackageManager(this.app.path);
	}

	install(req, res) {
		const name = this.getPkgFromRequest(req);
		const conf = this.app.config.get<IClientConfig>(this.app.mode, ConfigType.CLIENT);
		const clientManager = new PackageManager(join(this.app.path, conf.packageJsonPath));
		return clientManager.install(name)
			.then(() => res.status(200).send())
			.catch(err => res.status(500).send(err));
	}

	async installAll(req, res) {
		await this._kill(this.proc);
		const conf = this.app.config.get<IClientConfig>(this.app.mode, ConfigType.CLIENT);
		if (! conf || ! conf.www) {
			return res.status(401).send({ error: true, message: 'No client config found' });
		}
		const clientManager = new PackageManager(join(this.app.path, conf.packageJsonPath));
		try {
			const result = await clientManager.installAllInBackground();
			this.proc = result.proc;
			res.status(200).send();
		} catch (err) {
			res.status(500).send(err);
		}
		this.websocket.broadcast({
			type: 'client:install-all:progress',
			data: join(this.app.path, conf.packageJsonPath)
		});
		this.websocket.broadcast({
			type: 'client:install-all:progress',
			data: `${clientManager.managerName === 'yarn' ? '$ yarn install' : '$ npm install'}`
		});
		this.proc.stdout.on('data', d => {
			this.websocket.broadcast({
				type: 'client:install-all:progress',
				data: d.toString()
			});
		});
		this.proc.stderr.on('data', d => {
			this.websocket.broadcast({
				type: 'client:install-all:progress',
				data: d.toString()
			});
		});

		this.proc.on('close', (code, signal) => {
			if (code) {
				this.websocket.broadcast({
					type: 'client:install-all:fail',
					data: code + signal
				});
			} else {
				this.websocket.broadcast({
					type: 'client:install-all:success'
				});
			}
		});
	}

	async startWatching(req, res) {
		const conf = this.app.config.get<IClientConfig>(this.app.mode, ConfigType.CLIENT);
		const script = conf.scripts && conf.scripts.watch ? conf.scripts.watch : 'watch';
		await this._kill(this.proc);
		try {
			this.packageManager.setBasepath(join(this.app.path, conf.packageJsonPath));
			const result = await this.packageManager.runScriptInBackground(script);
			this.proc = result.proc;
			res.status(200).send();
		} catch (err) {
			res.status(500).send(err);
		}
		let last = -1;
		const errors = [];
		let building = false;
		const sendProgress = (data) => {
			const progress = this._parseProgress(data);
			const err = this._parseErrors(data);
			const end = this._parseEnd(data);

			if ( ! building) {
				this.websocket.broadcast({
					type: 'client:watch:building',
					status: data
				});
				building = true;
			}

			if (progress) {
				if (parseFloat(progress.progress) > last) {
					this.app.logger.log(`npm run ${script}: ${data}`);
					last = parseFloat(progress.progress);
				}
				this.websocket.broadcast({
					type: 'client:watch:progress',
					progress: progress.progress,
					status: progress.progressStatus
				});
			} else if (end) {
				building = false;
				if (errors.length) {
					this.websocket.broadcast({
						type: 'client:build:error',
						error: errors,
						hasStatic: this.app.server.hasStatic()
					});
				} else {
					this.websocket.broadcast({
						type: 'client:build:success',
						hasStatic: this.app.server.hasStatic()
					});
				}
			} else if (err.length) {
				errors.concat(err);
				if ( ! building ) {
					this.websocket.broadcast({
						type: 'client:build:error',
						error: errors,
						hasStatic: this.app.server.hasStatic()
					});
				}
			} else {
				this.app.logger.log(data);
				this.websocket.broadcast({
					type: 'client:watch:building',
					status: data
				});
			}
		};

		this.proc.stdout.on('data', d => {
			sendProgress(d.toString());
		});
		this.proc.stderr.on('data', d => {
			sendProgress(d.toString());
		});

		this.proc.on('close', code => {
			this.websocket.broadcast({
				type: 'client:watch:terminate',
				hasStatic: this.app.server.hasStatic()
			});
		});
	}

	stopWatching(req, res) {
		this._kill(this.proc).then(() => {
			res.status(200).send();
		}).catch(e => {
			res.status(500).send(e);
		});
	}

	build(req, res) {
		res.status(200).send({});
		this.websocket.broadcast({
			type: 'client:build',
			message: 'Launch build-script'
		});
		const conf = this.app.config.get<IClientConfig>(this.app.mode, ConfigType.CLIENT);
		let script = null;
		if ( ! req.body.prod && conf.scripts.build) {
			script = conf.scripts.build;
		}
		if (req.body.prod && conf.scripts.prod) {
			script = conf.scripts.prod;
		}
		if (script) {
			const packageJsonPath = conf && conf.packageJsonPath ? join(this.app.path, conf.packageJsonPath) : this.app.path;
			this.packageManager.setBasepath(packageJsonPath);
			this.packageManager.runScript(script, (data, error) => {
				const progress = this._parseProgress(data);
				if (progress) {
					this.websocket.broadcast({
						type: 'client:build:progress',
						progress: progress.progress,
						status: progress.progressStatus
					});
				}
			}).then(() => {
				this.websocket.broadcast({
					type: 'client:build:success',
					hasStatic: this.app.server.hasStatic()
				});
			}).catch(error => this.websocket.broadcast({
				type: 'client:build:error',
				hasStatic: this.app.server.hasStatic(),
				error
			}));
		} else {
			this.websocket.broadcast({
				type: 'client:build:error',
				hasStatic: this.app.server.hasStatic(),
				error: new Error(`'${req.body.prod ? 'prod' : 'build'}' script not found in client settings.`)
			});
		}
	}


	private _parseProgress(data) {
		const match = chalk.bold.yellow(data).match(/([0-9]{1,2})% ([^%]+)$/);
		if (match) {
			return {
				progress: match[1],
				progressStatus: match[2]
			};
		}
		return false;
	}

	private _parseEnd(data) {
		const matchEnd = chalk.bold.yellow(data).match(/Date: (.*)(\n| - )Hash: (.*)(\n| - )Time: (.*)/);
		if (matchEnd) {
			return {
				date: matchEnd[1],
				hash: matchEnd[3],
				time: matchEnd[5]
			};
		}
	}

	private _parseErrors(data) {
		const dataStripped = chalk.bold.yellow(data);
		const matchError = data.match(/Error in /);
		if (matchError) {

			/**
			 * Try to parse Typescript / javascript errors:
			 * Error in client/src/app/app-routing.module.ts(11,3):
			 * error TS1068: Unexpected token. A constructor, method, accessor, or property was expected.
			 */
			const errors = dataStripped.substr('Error in '.length)
				.split('\n')
				.map(errorLine => {
					const matchErrorLine = errorLine.match(/(.+)\(([0-9]+),([0-9]+)\): (.*)/);
					if (matchErrorLine) {
						return {
							file: matchErrorLine[1],
							line: matchErrorLine[2],
							column: matchErrorLine[3],
							message: matchErrorLine[4]
						};
					}
				}).filter(d => !!d);
			if (errors.length > 0) {
				return errors;
			}

			/**
			 * Try to parse CSS errors:
			 * ERROR in ./client/src/app/app.component.scss
			 * Module build failed:
			 * gfds
			 * ^
			 * Invalid CSS after " gfds": expected "{", was ""
			 * in /Users/thyb/projects/materia/apps/resto-angular6/client/src/app/app.component.scss (line 1, column 2)
			 */

			if (dataStripped.match(/Module build failed: /)) {
				let startRegister = -1;
				const errorsCss = [];
				let currentError = null;
				dataStripped.split('\n').forEach((v, k) => {
					if (v.substr(0, 9) == 'ERROR in ') {
						if (currentError) {
							errorsCss.push(currentError);
						}
						startRegister = -1;
						currentError = {
							file: v.substr(9),
							message: ''
						} as any;
					} else if (v == 'Module build failed: ') {
						startRegister = k + 1;
					} else if (startRegister <= k) {
						currentError.message += v + '\n';
					}
				});
				return errorsCss;
			}
		}
		return [];
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

	private getPkgFromRequest(req) {
		let pkg = req.params.dependency;
		if (req.params[0]) {
			pkg += req.params[0];
		}
		return pkg;
	}

}