import { App } from '../../lib';

// const npm = require('npm');
// import { buffer } from './buffer';

import * as path from 'path';
// import * as cp from 'child_process';
import * as fs from 'fs';
import * as execa from 'execa';

export class Npm {
	constructor(private app: App) {}

	run(command: string, params?: string[], output?: (data: any, error?: boolean) => void): Promise<any> {
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
				if (output) {
					output(d.toString());
				}
				data += d;
			});
			stream.stderr.on('data', (d) => {
				console.log(`stderr: ${d}`);
				if (output) {
					output(d.toString(), true);
				}
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