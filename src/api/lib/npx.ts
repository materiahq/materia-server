import * as execa from 'execa';
import * as which from 'which';

import { App } from '../../lib';

export class Npx {

	constructor(private app: App) {}

	exec(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			return this._getNpxPath().then(npxPath => {
				let data = '';
				const stream = execa(npxPath, [command, ...params], {
					cwd: this.app.path
				});
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
		});
	}

	private _getNpxPath() {
		return new Promise((resolve, reject) => {
			which('npx', (err, npxPath) => {
				if (err && ! npxPath) {
					if (this.app) {
						this.app.logger.error(`npx -> path error: ${err}`);
					}
					reject(err);
				} else {
					if (this.app) {
						this.app.logger.log(`npx -> path: ${npxPath}`);
					}
					resolve(npxPath);
				}
			});
		});
	}
}