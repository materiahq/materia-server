import { App } from '../../lib';

// const npm = require('npm');
// import { buffer } from './buffer';

import * as path from 'path';
// import * as cp from 'child_process';
import * as fs from 'fs';
import * as execa from 'execa';

export class Npm {
	constructor(private app: App) {}

	execInBackground(command: string, params?: string[]) {
		return this._exec(command, params);
	}

	exec(command: string, params?: string[], stream?: (data: any, error?: boolean) => void): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';

			let proc = this._exec(command, params);

			proc.stdout.on('data', d => {
				if (stream) {
					stream(d.toString());
				}
				data += d;
			});
			proc.stderr.on('data', (d) => {
				if (stream) {
					stream(d.toString(), true);
				}
				data += d;
			});

			proc.on('close', (code) => {
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

	private _exec(command: string, params?: string[]) {
		if (!params) {
			params = [];
		}
		if (fs.existsSync(path.resolve(`node_modules/.bin/npm`))) {
			return execa(path.resolve(`node_modules/.bin/npm`), [command, ...params], {
				cwd: this.app.path
			});
		} else {
			return execa(path.join(path.resolve(), `resources/node_modules/.bin/npm`), [command, ...params], {
				cwd: this.app.path
			});
		}
	}

}