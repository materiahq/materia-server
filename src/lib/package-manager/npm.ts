import * as execa from 'execa';
import * as which from 'which';
import chalk from 'chalk';

export class Npm {

	constructor(private cwd: string) {}

	execInBackground(command: string, params?: string[], cwd?: string) {
		return this.getNpmPath().then(npmPath => {
			const npmProc = execa(npmPath, [command, ...params], {
				cwd: cwd ? cwd : this.cwd
			});
			return { proc: npmProc };
		});
	}

	exec(command: string, params?: string[], cwd?: string, stream?: (data: any, error?: boolean) => void): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			return this.getNpmPath().then(npmPath => {
				if (stream) {
					stream(`$ npm ${command} ${params.join(' ')}`);
				}
				const proc = execa(npmPath, [command, ...params], {
					cwd: cwd ? cwd : this.cwd
				});
				let working = true;
				proc.stdout.on('data', d => {
					if (stream && working) {
						stream(d.toString());
					}
					data += d;
				});
				proc.stderr.on('data', (d) => {
					if (stream && working) {
						const colorized = d.toString().includes('ERR') ? chalk.red(d.toString()) : chalk.yellow(d.toString());
						stream(colorized, true);
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

	private getNpmPath(): Promise<string> {
		return new Promise((resolve, reject) => {
			which('npm', { all: true }, (err, npmPaths) => {
				if (err) {
					reject(err);
				} else {
					resolve(npmPaths.find(p => ! p.includes('materia-designer')));
				}
			});
		});
	}
}