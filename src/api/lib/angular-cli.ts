import { App } from '../../lib';

import * as path from 'path';
import * as fs from 'fs';
import * as execa from 'execa';

export class AngularCli {
	config: any;

	constructor(private app: App) { }

	exec(command: string, params?: string[]): Promise<any> {
		return new Promise((resolve, reject) => {
			let data = '';
			let stream = null;
			if (fs.existsSync(path.join(this.app.path, "node_modules", ".bin", "ng"))) {
				stream = execa(path.join(this.app.path, "node_modules", ".bin", "ng"), [command, ...params], {
					cwd: this.app.path
				});
			} /*else {
				stream = execa(path.join(path.resolve(), `resources/node_modules/.bin/npm`), [command, ...params], {
					cwd: this.app.path
				});
			}*/
			stream.stdout.on('data', d => {
				console.log(`Ng stdout: ${d}`);
				data += d;
			});
			stream.stderr.on('data', (d) => {
				console.log(`Ng stderr: ${d}`);
				data += d;
			});

			stream.on('close', (code) => {
				console.log(`Ng child process exited with code ${code}`);
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
	}

	getConfig() {
		return new Promise((resolve, reject) => {
			fs.readFile(path.join(this.app.path, 'angular.json'), 'utf-8', (e, data) => {
				if (e) {
					reject(e);
				} else {
					this.config = JSON.parse(data);
					resolve(JSON.parse(data));
				}
			});
		});
	}

	getTsConfig(spec?) {
		return new Promise((resolve, reject) => {
			let tsPath = null;
			if (spec) {
				tsPath = 'tsconfig.spec.json'
			} else {
				tsPath = 'tsconfig.app.json'
			}
			fs.readFile(path.join(this.app.path, 'client', 'src', tsPath), 'utf-8', (e, data) => {
				if (e) {
					reject(e);
				} else {
					resolve(JSON.parse(data));
				}
			});
		});

	}

	initNewConfig() {
		return new Promise((resolve, reject) => {
			this.getConfig().then(() => {
				this.config.projects[this.app.config.packageJson.name].sourceRoot = 'client/src';
				this.config.projects[this.app.config.packageJson.name].architect.build.options = Object.assign({},
					this.config.projects[this.app.config.packageJson.name].architect.build.options,
					{
						"outputPath": "client/dist",
						"index": "client/src/index.html",
						"main": "client/src/main.ts",
						"polyfills": "client/src/polyfills.ts",
						"tsConfig": "client/src/tsconfig.app.json",
						"assets": [
							"client/src/favicon.ico",
							"client/src/assets"
						],
						"styles": [
							"client/src/styles.scss"
						],
						"scripts": []
					});

				this.config.projects[this.app.config.packageJson.name].architect.build.configurations = Object.assign({},
					this.config.projects[this.app.config.packageJson.name].architect.build.configurations,
					{
						"production": {
							"fileReplacements": [
								{
									"replace": "client/src/environments/environment.ts",
									"with": "client/src/environments/environment.prod.ts"
								}
							],
							"optimization": true,
							"outputHashing": "all",
							"sourceMap": false,
							"extractCss": true,
							"namedChunks": false,
							"aot": true,
							"extractLicenses": true,
							"vendorChunk": false,
							"buildOptimizer": true
						}
					})

				this.config.projects[this.app.config.packageJson.name].architect.test = {
					"builder": "@angular-devkit/build-angular:karma",
					"options": {
						"main": "client/src/test.ts",
						"polyfills": "client/src/polyfills.ts",
						"tsConfig": "client/src/tsconfig.spec.json",
						"karmaConfig": "client/src/karma.conf.js",
						"styles": [
							"client/src/styles.scss"
						],
						"scripts": [],
						"assets": [
							"client/src/favicon.ico",
							"client/src/assets"
						]
					}
				}
				this.config.projects[this.app.config.packageJson.name].architect.lint = {
					"builder": "@angular-devkit/build-angular:tslint",
					"options": {
						"tsConfig": [
							"client/src/tsconfig.app.json",
							"client/src/tsconfig.spec.json"
						],
						"exclude": [
							"**/node_modules/**"
						]
					}
				}
				this._initTsFiles().then(() =>	resolve());
			});
		});
	}

	_initTsFiles() {
		return new Promise((resolve, reject) => {
			this.getTsConfig().then((tsConfig: any) => {
				tsConfig.extends = "../../tsconfig.json";
				this.app.saveFile(path.join(this.app.path, 'client', 'src', 'tsconfig.app.json'), JSON.stringify(tsConfig, null, 2)).then(() => {
					this.getTsConfig(true).then((tsSpecConfig: any) => {
						tsSpecConfig.extends = "../../tsconfig.json";
						this.app.saveFile(path.join(this.app.path, 'client', 'src', 'tsconfig.spec.json'), JSON.stringify(tsSpecConfig, null, 2)).then(() => {
							resolve();
						});
					});
				});
			});
		});
	}

	saveConfig() {
		return this.app.saveFile(path.join(this.app.path, 'angular.json'), JSON.stringify(this.config, null, 2));
	}

}