// const npm = require('npm');
// import { buffer } from './buffer';

// import * as cp from 'child_process';
import * as execa from 'execa';
import { App } from '../../lib';
import * as which from 'which';
import * as path from 'path';

export class Npm {
	app: App;
	constructor(private cwd: string, global = false) {}

	enableLogger(app: App) { this.app = app; }

	// useLocalNpm() { this.global = false; }
	// useGlobalNpm() { this.global = true; }

	execInBackground(command: string, params?: string[]) {
		if (this.app) {
			this.app.logger.log(`NPM -> ${command} ${params.join(' ')}`);
		}
		return this.getNpmPath().then(npmPath => {
			return execa(npmPath, [command, ...params], {
				cwd: this.cwd
			});
		})
	}

	execInFolderBackground(folder: string, command: string, params?: string[]) {
		if (this.app) {
			this.app.logger.log(`NPM -> ${command} ${params.join(' ')}`);
		}
		return this.getNpmPath().then(npmPath => {
			const npmProc = execa(npmPath, [command, ...params], {cwd: folder ? folder : this.cwd});
			return { proc: npmProc };
		});
	}

	exec(command: string, params?: string[], stream?: (data: any, error?: boolean) => void): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';

			return this.getNpmPath().then(npmPath => {
				if (this.app) {
					this.app.logger.log(`NPM -> ${command} ${params.join(' ')}`);
					this.app.logger.log(`NPM binary used: ${npmPath}`)
				}
				const proc = execa(npmPath, [command, ...params], {
					cwd: this.cwd
				})
				let working = true;
				proc.stdout.on('data', d => {
					if (this.app) {
						this.app.logger.log(`npm stdout: ${d.toString()}`)
					}
					if (stream && working) {
						stream(d.toString());
					}
					data += d;
				});
				proc.stderr.on('data', (d) => {
					if (this.app) {
						this.app.logger.log(`npm stderr: ${d.toString()}`)
					}
					if (stream && working) {
						stream(d.toString(), true);
					}
					data += d;
				});

				proc.on('close', (code) => {
					working = false;
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


	execInFolder(folder: string, command: string, params?: string[], stream?: (data: any, error?: boolean) => void): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			return this.getNpmPath().then(npmPath => {
				if (this.app) {
					this.app.logger.log(`NPM -> ${command} ${params.join(' ')}`);
					this.app.logger.log(`NPM binary used: ${npmPath}`)
				}
				const proc = execa(npmPath, [command, ...params], {
					cwd: path.join(this.cwd, folder)
				})
				let working = true;
				proc.stdout.on('data', d => {
					if (this.app) {
						this.app.logger.log(`npm stdout: ${d.toString()}`)
					}
					if (stream && working) {
						stream(d.toString());
					}
					data += d;
				});
				proc.stderr.on('data', (d) => {
					if (this.app) {
						this.app.logger.log(`npm stderr: ${d.toString()}`)
					}
					if (stream && working) {
						stream(d.toString(), true);
					}
					data += d;
				});

				proc.on('close', (code) => {
					working = false;
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

	private getNpmPath() {
		return new Promise((resolve, reject) => {
			which('npm', (err, npmPath) => {
				if (err && !npmPath) {
					if (this.app) {
						this.app.logger.error(`npm -> path error: ${err}`)
					}
					return reject(err);
				} else {
					if (this.app) {
						this.app.logger.log(`npm -> path: ${npmPath}`)
					}
					return resolve(npmPath)
				}
			});
		});
	}
}