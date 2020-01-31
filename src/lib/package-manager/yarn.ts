import { NodeManager } from './node-manager';

export class Yarn extends NodeManager {

	constructor(cwd: string) {
		super(cwd, 'yarn');
	}

	install(packageName: string, cwd: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('add', [packageName], cwd, stream);
	}

	installDev(packageName: string, cwd: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('add', [packageName, '-D'], cwd, stream);
	}

	uninstall(packageName: string, cwd: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('remove', [packageName], cwd, stream);
	}

	upgrade(packageName: string, cwd: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('upgrade', [packageName, '--latest'], cwd, stream);
	}

	runScript(scriptName: string, cwd: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('run', [scriptName], cwd, stream);
	}

	runScriptInBackground(scriptName: string, cwd?: string) {
		return this._execInBackground('run', [scriptName], cwd);
	}

	getExecutable(): Promise<string> {
		return this._getManagerExecutable('yarn');
	}

}