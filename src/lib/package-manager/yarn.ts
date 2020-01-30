import * as execa from 'execa';
import * as which from 'which';
import chalk from 'chalk';

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

	async exec(command: string, params?: string[], cwd?: string, stream?: (data: any, error?: boolean) => void): Promise<any> {
		try {
			const yarnPath = await this.getYarnPath();
			if (stream) {
				stream(`$ yarn ${command} ${params.join(' ')}`);
			}
			const proc = execa(yarnPath, [command, ...params], {
				cwd: cwd ? cwd : this.cwd
			});
			proc.stdout.on('data', d => {
				if (stream) {
					stream(d.toString());
				}
			});
			proc.stderr.on('data', (d) => {
				if (stream) {
					const colorized = d.toString().includes('err') ? chalk.red(d.toString()) : chalk.yellow(d.toString());
					stream(colorized, true);
				}
			});
			return proc;
		} catch (err) {
			return Promise.reject(err);
		}
	}

	private getYarnPath(): Promise<string> {
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