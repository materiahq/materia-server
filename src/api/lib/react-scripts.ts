import { App } from '../../lib';

import * as path from 'path';
import * as fs from 'fs';
import * as execa from 'execa';

export class ReactScripts {
	config: any;

	constructor(private app: App) { }

	exec(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.join(this.app.path, 'node_modules', '.bin', 'react-scripts'))) {
				stream = execa(path.join(this.app.path, 'node_modules', '.bin', 'react-scripts'), [command, ...params], {
					cwd: this.app.path
				});
			} /*else {
				stream = execa(path.join(path.resolve(), `resources/node_modules/.bin/npm`), [command, ...params], {
					cwd: this.app.path
				});
			}*/
			stream.stdout.on('data', d => {
				data += d;
			});
			stream.stderr.on('data', (d) => {
				data += d;
			});

			stream.on('close', (code) => {
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