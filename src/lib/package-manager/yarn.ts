import * as execa from 'execa';
import * as which from 'which';

export class Yarn {

	constructor(private cwd: string) {}

	execInBackground(command: string, params?: string[], cwd?: string) {
		return this.getYarnPath().then(yarnPath => {
			const yarnProc = execa(yarnPath, [command, ...params], {
				cwd: cwd ? cwd : this.cwd
			});
			return { proc: yarnProc };
		});
	}

	exec(command: string, params?: string[], cwd?: string, stream?: (data: any, error?: boolean) => void): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			return this.getYarnPath().then(yarnPath => {
				if (stream) {
					stream(`$ yarn ${command} ${params.join(' ')}`);
				}
				const proc = execa(yarnPath, [command, ...params], {
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

	private getYarnPath() {
		return new Promise((resolve, reject) => {
			which('yarn', (err, yarnPath) => {
				if (err && ! yarnPath) {
					reject(err);
				} else {
					resolve(yarnPath);
				}
			});
		});
	}
}