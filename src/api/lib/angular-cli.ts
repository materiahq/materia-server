import {join } from 'path';
import * as fs from 'fs';
import * as execa from 'execa';

import { App } from '../../lib';

export class AngularCli {
	config: any;

	constructor(private app: App) { }

	exec(command: string, params?: string[], cwd?: string): Promise<string> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if ( ! cwd) {
				cwd = this.app.path;
			}
			if (fs.existsSync(join(cwd, 'node_modules', '.bin', 'ng'))) {
				stream = execa(join(cwd, 'node_modules', '.bin', 'ng'), [command, ...params], {
					cwd: cwd
				});
				stream.stdout.on('data', d => {
					data += d;
				});
				stream.stderr.on('data', (d) => {
					data += d;
				});

				stream.on('close', (code) => {
					if (code == 0) {
						return resolve(data);
					} else {
						return reject({
							code,
							data
						});
					}
				});
			} else {
				reject(new Error(`@angular/cli dependency not found in ${join(cwd, 'node_modules')}`));
			}
		});
	}

	getConfig() {
		return new Promise((resolve, reject) => {
			fs.readFile(join(this.app.path, 'angular.json'), 'utf-8', (e, data) => {
				if (e) {
					reject(e);
				} else {
					this.config = JSON.parse(data);
					resolve(JSON.parse(data));
				}
			});
		});
	}

	initNewMonopackageConfig(projectName: string) {
		return new Promise((resolve, reject) => {
			this.getConfig().then(() => {
				this.config.projects[projectName].root = 'client';
				this.config.projects[projectName].sourceRoot = 'client/src';
				this.config.projects[projectName].architect.build.options = Object.assign({},
					this.config.projects[projectName].architect.build.options,
					{
						'outputPath': 'client/dist',
						'index': 'client/src/index.html',
						'main': 'client/src/main.ts',
						'polyfills': 'client/src/polyfills.ts',
						'tsConfig': 'client/src/tsconfig.app.json',
						'assets': [
							'client/src/favicon.ico',
							'client/src/assets'
						],
						'styles': [
							'client/src/styles.scss'
						],
						'scripts': []
					});

				this.config.projects[projectName].architect.build.configurations = Object.assign({},
					this.config.projects[projectName].architect.build.configurations,
					{
						'production': {
							'fileReplacements': [
								{
									'replace': 'client/src/environments/environment.ts',
									'with': 'client/src/environments/environment.prod.ts'
								}
							],
							'optimization': true,
							'outputHashing': 'all',
							'sourceMap': false,
							'extractCss': true,
							'namedChunks': false,
							'aot': true,
							'extractLicenses': true,
							'vendorChunk': false,
							'buildOptimizer': true
						}
					});

				this.config.projects[projectName].architect.test = {
					'builder': '@angular-devkit/build-angular:karma',
					'options': {
						'main': 'client/src/test.ts',
						'polyfills': 'client/src/polyfills.ts',
						'tsConfig': 'client/src/tsconfig.spec.json',
						'karmaConfig': 'client/src/karma.conf.js',
						'styles': [
							'client/src/styles.scss'
						],
						'scripts': [],
						'assets': [
							'client/src/favicon.ico',
							'client/src/assets'
						]
					}
				};
				this.config.projects[projectName].architect.lint = {
					'builder': '@angular-devkit/build-angular:tslint',
					'options': {
						'tsConfig': [
							'client/src/tsconfig.app.json',
							'client/src/tsconfig.spec.json'
						],
						'exclude': [
							'**/node_modules/**'
						]
					}
				};
				const e2eConfig = this.config.projects[`${projectName}-e2e`];
				e2eConfig.root = 'client/e2e';
				e2eConfig.architect.e2e.options = Object.assign({}, e2eConfig.architect.e2e.options, {
					'protractorConfig': 'client/e2e/protractor.conf.js'
				});
				e2eConfig.architect.lint.options = Object.assign({}, e2eConfig.architect.lint.options, {
					'tsConfig': 'client/e2e/tsconfig.e2e.json'
				});
				resolve();
			});
		});
	}

	saveConfig() {
		return this.app.saveFile(join(this.app.path, 'angular.json'), JSON.stringify(this.config, null, 2));
	}

}