import { App } from '../../lib';

import * as path from 'path';
import * as fs from 'fs';
import * as execa from 'execa';

export class VueCli {
	config: any;

	constructor(private app: App) { }

	execVue(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.join(this.app.path, "node_modules", ".bin", "vue"))) {
				stream = execa(path.join(this.app.path, "node_modules", ".bin", "vue"), [command, ...params], {
					cwd: this.app.path
				});
			} /*else {
				stream = execa(path.join(path.resolve(), `resources/node_modules/.bin/npm`), [command, ...params], {
					cwd: this.app.path
				});
			}*/
			stream.stdout.on('data', d => {
				console.log(`Ng stdout: ${d}`);
				data += d;
			});
			stream.stderr.on('data', (d) => {
				console.log(`Ng stderr: ${d}`);
				data += d;
			});

			stream.on('close', (code) => {
				console.log(`Ng child process exited with code ${code}`);
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

	execVueCliService(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.join(this.app.path, "node_modules", ".bin", "vue-cli-service"))) {
				stream = execa(path.join(this.app.path, "node_modules", ".bin", "vue-cli-service"), [command, ...params], {
					cwd: this.app.path
				});
			} else {
				reject(new Error('vue-cli-service not found'))
			}/*else {
				stream = execa(path.join(path.resolve(), `resources/node_modules/.bin/npm`), [command, ...params], {
					cwd: this.app.path
				});
			}*/
			stream.stdout.on('data', d => {
				console.log(`Ng stdout: ${d}`);
				data += d;
			});
			stream.stderr.on('data', (d) => {
				console.log(`Ng stderr: ${d}`);
				data += d;
			});

			stream.on('close', (code) => {
				console.log(`Ng child process exited with code ${code}`);
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

	execVueCliServiceInFolder(folder: string, command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.join(this.app.path, folder, "node_modules", ".bin", "vue-cli-service"))) {
				stream = execa(path.join(this.app.path, folder, "node_modules", ".bin", "vue-cli-service"), [command, ...params], {
					cwd: path.join(this.app.path, folder)
				});
			} else {
				reject(new Error('vue-cli-service not found'))
			}/*else {
				stream = execa(path.join(path.resolve(), `resources/node_modules/.bin/npm`), [command, ...params], {
					cwd: this.app.path
				});
			}*/
			stream.stdout.on('data', d => {
				console.log(`Ng stdout: ${d}`);
				data += d;
			});
			stream.stderr.on('data', (d) => {
				console.log(`Ng stderr: ${d}`);
				data += d;
			});

			stream.on('close', (code) => {
				console.log(`Ng child process exited with code ${code}`);
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