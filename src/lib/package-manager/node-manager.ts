import * as which from 'which';
import * as execa from 'execa';
import chalk from 'chalk';

export abstract class NodeManager {
	constructor(private cwd: string, private manager: 'yarn'|'npm') {}

	installAll(cwd?: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('install', [], cwd), stream;
	}

	installAllInBackground(cwd?: string) {
		return this._execInBackground('install', [], cwd);
	}

	protected async _exec(command: string, params?: string[], cwd?: string, stream?: (data: any, error?: boolean) => void) {
		try {
			const managerExecutable = await this._getManagerExecutable(this.manager);
			if (stream) {
				stream(`$ ${this.manager} ${command} ${params.join(' ')}`);
			}
			const proc = execa(managerExecutable, [command, ...params], {
				cwd: cwd ? cwd : this.cwd
			});
			proc.stdout.on('data', d => {
				if (stream) {
					stream(d.toString());
				}
			});
			proc.stderr.on('data', (d) => {
				if (stream) {
					stream(this._colorizeErrorOutput(d.toString()), true);
				}
			});
			return proc;
		} catch (err) {
			return Promise.reject(err);
		}
	}

	protected async _execInBackground(command: string, params?: string[], cwd?: string) {
		try {
			const managerExecutable = await this._getManagerExecutable(this.manager);
			const proc = execa(managerExecutable, [command, ...params], {
				cwd: cwd ? cwd : this.cwd
			});
			return { proc };
		} catch (err) {
			return Promise.reject(err);
		}
	}

	protected _getManagerExecutable(manager: 'yarn'|'npm'): Promise<string> {
		return new Promise((resolve, reject) => {
			which(manager, (err, yarnPath) => {
				if (err && ! yarnPath) {
					reject(err);
				} else {
					resolve(yarnPath);
				}
			});
		});
	}

	abstract getExecutable();
	abstract install(packageName: string, cwd: string, stream?: (data: any, error?: boolean) => void);
	abstract uninstall(packageName: string, cwd: string, stream?: (data: any, error?: boolean) => void);
	abstract upgrade(packageName: string, cwd: string, stream?: (data: any, error?: boolean) => void);
	abstract runScript(scriptName: string, cwd: string, stream?: (data: any, error?: boolean) => void);
	abstract runScriptInBackground(scriptName: string, cwd?: string);

	private _colorizeErrorOutput(stderr: string) {
		return stderr.includes(this.manager === 'yarn' ? 'err' : 'ERR') ? chalk.red(stderr) : chalk.yellow(stderr);
	}
}