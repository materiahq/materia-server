import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { IClientBuild } from '@materia/interfaces';

import { App } from './app';
import { ConfigType } from './config';

export enum ScriptMode {
	WATCH = <any>'watch',
	BUILD = <any>'build',
	PROD = <any>'prod'
}

export class Client {
	config: IClientBuild = {};
	pkgPath: string;
	pkgScripts: string[];
	watching: boolean;

	constructor(private app: App) {
		this.watching = false;
	}

	load(): Promise<void> {
		this.app.logger.log(` └─┬ Client `);
		this.config = this.app.config.get<IClientBuild>(this.app.mode, ConfigType.CLIENT);
		if ( ! this.config ) {
			this.config = { build: false };
			this.app.logger.log(` │ └── ${chalk.bold('No build scripts detected')}`);
		}

		if ( ! this.config.www ) {
			this.config.www = '';
		} else {
			this.app.logger.log(` │ └── Static folder ${chalk.bold('./' + this.config.www)} detected`);
		}
		if ( ! this.config.packageJsonPath) {
			this.config.packageJsonPath = '';
		} else {
			this.config.build = true;
		}
		if (this.config.packageJsonPath || this.config.build)  {
			this.app.logger.log(` │ └── ${chalk.bold('Build system detected')}`);
		}

		if ( ! this.config.scripts ) {
			this.config.scripts = {};
		} else {
			let packagePath = './package.json';
			if (this.config.packageJsonPath) {
				packagePath = `./${this.config.packageJsonPath}/package.json`;
			}
			this.app.logger.log(` │ └── Build scripts detected in ${chalk.bold(packagePath)}`);
		}

		if ( ! this.config.autoWatch ) {
			this.config.autoWatch = false;
		}
		this.app.logger.log(` │ └── ${chalk.green.bold('OK')}`);
		return Promise.resolve();
	}

	hasOneScript(): boolean {
		return !!(
			(this.hasBuildScript(ScriptMode.BUILD) ||
			this.hasBuildScript(ScriptMode.WATCH) ||
			this.hasBuildScript(ScriptMode.PROD)) &&
			this.config.www
		);
	}

	hasBuildScript(mode?: ScriptMode, script?: string): boolean {
		if ( ! this.config || ! this.config.www || (this.config.www && ! this.config.build && ! this.config.packageJsonPath)) {
			return false;
		}
		try {
			let pkgTxt = '';
			if (fs.existsSync(path.join(this.app.path, this.config.packageJsonPath, 'package.json'))) {
				pkgTxt = fs.readFileSync(path.join(this.app.path, this.config.packageJsonPath, 'package.json'), 'utf-8');
				this.pkgPath = path.join(this.app.path, this.config.packageJsonPath);
			} else if (fs.existsSync(path.join(this.app.path, 'package.json'))) {
				pkgTxt = fs.readFileSync(path.join(this.app.path, 'package.json'), 'utf-8');
				this.pkgPath = this.app.path;
			} else {
				return false;
			}
			const pkg = JSON.parse(pkgTxt);

			let scriptToRun = script;
			if ( ! scriptToRun ) {
				switch (mode) {
					case ScriptMode.WATCH:
						scriptToRun = this.config.scripts.watch;
						break;
					case ScriptMode.BUILD:
						scriptToRun = this.config.scripts.build;
						break;
					case ScriptMode.PROD:
						scriptToRun = this.config.scripts.prod;
						break;
				}
			}
			if (pkg && pkg.scripts && pkg.scripts[scriptToRun]) {
				return true;
			}
		} catch (e) {
		}
		return false;
	}
}
