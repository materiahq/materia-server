import { NodeManager } from './node-manager';

export class Npm extends NodeManager {

	constructor(cwd: string) {
		super(cwd, 'npm');
	}

	install(packageName: string, cwd?: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('install', [packageName, '--save'], cwd, stream);
	}

	uninstall(packageName: string, cwd?: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('uninstall', [packageName, '--save'], cwd, stream);
	}

	upgrade(packageName: string, cwd?: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('upgrade', [packageName, '--save'], cwd, stream);
	}

	runScript(scriptName: string, cwd: string, stream?: (data: any, error?: boolean) => void) {
		return this._exec('run-script', [scriptName], cwd, stream);
	}

	runScriptInBackground(scriptName: string, cwd?: string) {
		return this._execInBackground('run-script', [scriptName], cwd);
	}

	getExecutable(): Promise<string> {
		return this._getManagerExecutable('npm');
	}
}