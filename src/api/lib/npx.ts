import { App } from "../../lib";

import * as path from 'path';
import * as cp from 'child_process';

import { buffer } from './buffer';
import * as fs from 'fs';
import * as execa from 'execa';

export class Npx {
	constructor(private app: App) {}

	call(args, bufferized?: boolean) {
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
			return buffer(proc);
		} else {
			return proc;
		}
	}

	exec(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.resolve(`node_modules/.bin/npx`))) {
				stream = execa(path.resolve(`node_modules/.bin/npx`), [command, ...params], {
					cwd: this.app.path
				});
			} else {
				stream = execa(path.join(path.resolve(), `resources/node_modules/.bin/npx`), [command, ...params], {
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