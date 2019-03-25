import { readFile, existsSync } from 'fs';
import * as which from 'which';
import { join } from 'path';
import { Npm } from './package-manager/npm';
import { Yarn } from './package-manager/yarn';

export class PackageManager {
	nodeModuleManager: Npm | Yarn;
	managerName: string;

	constructor(private basepath: string) {
		this.managerName = this.getPackageManagerName();
		this.nodeModuleManager = this.managerName === 'yarn' ? new Yarn(this.basepath) : new Npm(this.basepath);
	}

	runScriptInBackground(scriptName, cwd?: string) {
		if (this.managerName === 'yarn') {
			return this.nodeModuleManager.execInBackground('run', [scriptName], cwd ? cwd : this.basepath);
		} else {
			return this.nodeModuleManager.execInBackground('run-script', [scriptName], cwd ? cwd : this.basepath);
		}
	}

	runScript(scriptName: string, cwd?: string, stream?: (data: any, error?: boolean) => void) {
		if (this.managerName === 'yarn') {
			return this.nodeModuleManager.exec('run', [scriptName], cwd ? cwd : this.basepath, stream);
		} else {
			return this.nodeModuleManager.exec('run-script', [scriptName], cwd ? cwd : this.basepath, stream);
		}
	}

	uninstall(packageName: string, stream?: (data: any, error?: boolean) => void) {
		if (this.managerName === 'yarn') {
			return this.nodeModuleManager.exec('remove', [packageName], this.basepath, stream);
		} else {
			return this.nodeModuleManager.exec('uninstall', [packageName, '--save'], this.basepath, stream);
		}
	}

	upgrade(packageName: string, stream?: (data: any, error?: boolean) => void) {
		if (this.managerName === 'yarn') {
			return this.nodeModuleManager.exec('upgrade', [packageName], this.basepath, stream);
		} else {
			return this.nodeModuleManager.exec('upgrade', [packageName, '--save'], this.basepath, stream);
		}
	}

	install(packageName: string, stream?: (data: any, error?: boolean) => void) {
		if (this.managerName === 'yarn') {
			return this.nodeModuleManager.exec('add', [packageName], this.basepath, stream);
		} else {
			return this.nodeModuleManager.exec('install', [packageName, '--save'], this.basepath, stream);
		}
	}

	installAll(stream?: (data: any, error?: boolean) => void) {
		return this.nodeModuleManager.exec('install', [], this.basepath, stream);
	}

	installAllInBackground(cwd?: string) {
		return this.nodeModuleManager.execInBackground('install', [], cwd ? cwd : this.basepath);
	}

	getPackageManagerName(): string {
		if (existsSync(join(this.basepath, 'yarn.lock')) && which.sync('yarn', { nothrow: true })) {
			return 'yarn';
		}
		return 'npm';
	}

	getPackageJson(): Promise<any> {
		return new Promise((resolve, reject) => {
			const path = join(this.basepath, 'package.json');
			readFile(path, 'utf-8', (err, data) => {
				if (err) {
					return reject(err);
				}
				resolve(JSON.parse(data));
			});
		});
	}

	getDependencies(): Promise<any> {
		return this.getPackageJson().then(packageJson => packageJson.dependencies);
	}

	getDevdependencies(): Promise<any> {
		return this.getPackageJson().then(packageJson => packageJson.devDependencies);
	}

	getScripts(): Promise<any> {
		return this.getPackageJson().then(packageJson => packageJson.scripts);
	}

	hasNodeModules(): boolean {
		return existsSync(join(this.basepath, 'node_modules'));
	}
}
