import { App } from '../../lib';

const npm = require('npm');
import { buffer } from './buffer';

import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as execa from 'execa';

export class Npm {
	constructor(private app: App) {}
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
			return buffer(proc);
		} else {
			return proc;
		}
	}

	call(command, params) {
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

	exec(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.resolve(`node_modules/.bin/npm`))) {
				stream = execa(path.resolve(`node_modules/.bin/npm`), [command, ...params], {
					cwd: this.app.path
				});
			} else {
				stream = execa(path.join(path.resolve(), `resources/node_modules/.bin/npm`), [command, ...params], {
					cwd: this.app.path
				});
			}
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
}