import { readFile, existsSync } from 'fs';
import * as which from 'which';
import { join } from 'path';
import { Npm } from './package-manager/npm';
import { Yarn } from './package-manager/yarn';

export class PackageManager {
	nodeModuleManager: Npm | Yarn;
	managerName: string;

	constructor(private basepath: string) {
		this._init();
	}

	private _init() {
		this.managerName = this.getPackageManagerName();
		this.nodeModuleManager = this.managerName === 'yarn' ? new Yarn(this.basepath) : new Npm(this.basepath);
	}

	runScriptInBackground(scriptName) {
		return this.nodeModuleManager.runScriptInBackground(scriptName);
	}

	runScript(scriptName: string, stream?: (data: any, error?: boolean) => void) {
		return this.nodeModuleManager.runScript(scriptName, this.basepath, stream);
	}

	uninstall(packageName: string, stream?: (data: any, error?: boolean) => void) {
		return this.nodeModuleManager.uninstall(packageName, this.basepath, stream);
	}

	upgrade(packageName: string, stream?: (data: any, error?: boolean) => void) {
		return this.nodeModuleManager.upgrade(packageName, this.basepath, stream);
	}

	install(packageName: string, stream?: (data: any, error?: boolean) => void) {
		return this.nodeModuleManager.install(packageName, this.basepath, stream);
	}

	installAll(stream?: (data: any, error?: boolean) => void) {
		return this.nodeModuleManager.installAll(this.basepath, stream);
	}

	installAllInBackground() {
		return this.nodeModuleManager.installAllInBackground(this.basepath);
	}

	getPackageManagerName(): string {
		if (existsSync(join(this.basepath, 'yarn.lock')) && which.sync('yarn', { nothrow: true })) {
			return 'yarn';
		}
		return 'npm';
	}

	getPackageJson(packageName?: string): Promise<any> {
		return new Promise((resolve, reject) => {
			const path = packageName ? join(this.basepath, 'node_modules', packageName, 'package.json') :  join(this.basepath, 'package.json');
			readFile(path, 'utf-8', (err, data) => {
				if (err) {
					return reject(err);
				}
				resolve(JSON.parse(data));
			});
		});
	}

	getDependencies(packageName?: string): Promise<{[name: string]: string}> {
		return this.getPackageJson(packageName).then(packageJson => packageJson.dependencies);
	}

	getDevdependencies(packageName?: string): Promise<{[name: string]: string}> {
		return this.getPackageJson(packageName).then(packageJson => packageJson.devDependencies);
	}

	getScripts(packageName?: string): Promise<{[name: string]: string}> {
		return this.getPackageJson(packageName).then(packageJson => packageJson.scripts);
	}

	getVersion(packageName?: string): Promise<string> {
		return this.getPackageJson(packageName).then(packageJson => packageJson.version);
	}

	hasNodeModules(): boolean {
		return existsSync(join(this.basepath, 'node_modules'));
	}

	setBasepath(basepath: string): void {
		this.basepath = basepath;
		this._init();
	}
}
