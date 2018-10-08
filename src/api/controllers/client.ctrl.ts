import { App, ConfigType } from '../../lib';
import { Npm } from '../lib/npm';
import { WebsocketInstance } from '../../lib/websocket';
import { IClientConfig } from '@materia/interfaces';
import * as stripAnsi from 'strip-ansi';

export class ClientController {
	npm: Npm;

	npmProc: any;

	constructor(private app: App, private websocket: WebsocketInstance) {
		this.npm = new Npm(this.app.path);
	}

	startWatching(req, res) {
		res.status(200).send({})
		const conf = this.app.config.get<IClientConfig>(this.app.mode, ConfigType.CLIENT)
		const script = conf.scripts && conf.scripts.watch ? conf.scripts.watch : 'watch';

		this._kill(this.npmProc).then(() => {
			this.npmProc = this.npm.execInFolderBackground(conf.src, 'run-script', [script])

			let last = -1;
			let errors = []
			let building = false;
			const sendProgress = (data) => {
				const progress = this._parseProgress(data);
				const err = this._parseErrors(data);
				const end = this._parseEnd(data);

				if (progress) {
					if (!building) {
						this.websocket.broadcast({
							type: 'client:build'
						})
						building = true;
					}
					if (progress.progress > last) {
						this.app.logger.log(`npm run ${script}: ${data}`);
						last = progress.progress
					}
					this.websocket.broadcast({
						type: 'client:watch:progress',
						progress: progress.progress,
						status: progress.progressStatus
					})
				} else if (err.length) {
					errors.concat(err);
					if ( ! building ) {
						this.websocket.broadcast({
							type: 'client:build:error',
							error: errors,
							hasStatic: this.app.server.hasStatic()
						})
					}
				} else if (end) {
					building = false;
					if (errors) {
						this.websocket.broadcast({
							type: 'client:build:error',
							error: errors,
							hasStatic: this.app.server.hasStatic()
						})
					} else {
						this.websocket.broadcast({
							type: 'client:build:success',
							hasStatic: this.app.server.hasStatic()
						});
					}
				} else {
					this.app.logger.log(data);
				}
			}

			this.npmProc.stdout.on('data', d => {
				sendProgress(d.toString());
			})
			this.npmProc.stderr.on('data', d => {
				sendProgress(d.toString());
			})

			this.npmProc.on('close', code => {
				this.websocket.broadcast({
					type: 'client:watch:terminate'
				})
			})
		})
	}

	stopWatching(req, res) {
		this._kill(this.npmProc).then(() => {
			res.status(200).send();
		}).catch(e => {
			res.status(500).send(e);
		})
	}

	build(req, res) {
		res.status(200).send({});
		this.websocket.broadcast({
			type: 'client:build',
			message: 'Launch build-script'
		})
		const conf = this.app.config.get<IClientConfig>(this.app.mode, ConfigType.CLIENT)
		const script = conf.scripts && conf.scripts.build ? conf.scripts.build : 'build';
		this.npm.execInFolder(conf.src, 'run-script', [script], (data, error) => {
			const progress = this._parseProgress(data);
			if (progress) {
				this.websocket.broadcast({
					type: 'client:build:progress',
					progress: progress.progress,
					status: progress.progressStatus
				})
			}
		}).then((res) => {
			this.websocket.broadcast({
				type: 'client:build:success',
				hasStatic: this.app.server.hasStatic()
			})
		}).catch(error => this.websocket.broadcast({
			type: 'client:build:error',
			hasStatic: this.app.server.hasStatic(),
			error
		}))
	}


	private _parseProgress(data) {
		let match = stripAnsi(data).match(/([0-9]{1,2})% ([^%]+)$/)
		if (match) {
			return {
				progress: match[1],
				progressStatus: match[2]
			}
		}
		return false;
	}

	private _parseEnd(data) {
		let matchEnd = stripAnsi(data).match(/Date: (.*)(\n| - )Hash: (.*)(\n| - )Time: (.*)/)
		if (matchEnd) {
			return {
				date: matchEnd[1],
				hash: matchEnd[3],
				time: matchEnd[5]
			}
		}
	}

	private _parseErrors(data) {
		const dataStripped = stripAnsi(data);
		let matchError = data.match(/Error in /)
		if (matchError) {

			/**
			 * Try to parse Typescript / javascript errors:
			 * Error in client/src/app/app-routing.module.ts(11,3): error TS1068: Unexpected token. A constructor, method, accessor, or property was expected.
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
						}
					}
				}).filter(d => !!d)
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
				})
				return errorsCss;
			}
		}
		return [];
	}

	private _kill(stream): Promise<void> {
		if (!stream) {
			return Promise.resolve()
		}

		return new Promise((resolve, reject) => {
			let isWin = /^win/.test(process.platform);
			if (!isWin) {
				stream.kill('SIGINT')
				return resolve()
			} else {
				var cp = require('child_process');
				cp.exec('taskkill /PID ' + stream.pid + ' /T /F', (error, stdout, stderr) => { return resolve() })
			}
		});
	}

}