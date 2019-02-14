
import * as fs from 'fs';
import { join } from 'path';

import { App } from './app';

export class SelfMigration {

	constructor(private app: App) { }

	private fileExists(p: string): Promise<void> {
		return new Promise((resolve, reject) => {
			fs.exists(join(this.app.path, p), exists => {
				if (exists) {
					return resolve();
				} else {
					return reject();
				}
			});
		});
	}

	private readJsonFile(p: string): Promise<any> {
		return this.fileExists(p).then(() => {
			return new Promise((resolve, reject) => {
				fs.readFile(join(this.app.path, p), {
					encoding: 'utf-8'
				}, (err, data) => {
					if (err) {
						reject(err);
					}
					const json = JSON.parse(data);
					resolve(json);
				});
			});
		});
	}

	private checkMigrate_0_8() {
		const config: any = {};
		const configProd: any = {};

		return this.fileExists('materia.json')
			.catch(() => {
				return this.readJsonFile('package.json')
					.then(packageJson => {
						if (packageJson.materia) {
							config.name = packageJson.materia.name;
							config.icon = packageJson.materia.icon.color;
						}
					})
					.catch(() => {})
					.then(() => this.readJsonFile(join('.materia', 'server.json')))
					.then(serverContent => {
						let serverConfig;
						let serverConfigProd;
						if (serverContent.dev) {
							serverConfig = serverContent.dev;
							if (serverContent.prod) {
								 serverConfigProd = serverContent.prod;
							}
						} else if (serverContent) {
							serverConfig = serverContent;
						}

						if (serverConfig.web) {
							config.server = serverConfig.web;
							if (serverConfigProd.web) {
								configProd.server = serverConfigProd.web;
								if (configProd.server.live) {
									delete configProd.server.live;
								}
							}
						}

						if (serverConfig.database) {
							config.database = serverConfig.database;
							if (serverConfigProd.database) {
								configProd.database = serverConfigProd.database;
							}
						}

						if (serverConfig.sessions) {
							config.sessions = serverConfig.sessions;
							if (serverConfigProd.sessions) {
								configProd.sessions = serverConfigProd.sessions;
							}
						}
					})
					.catch(() => {})
					.then(() => this.readJsonFile(join('.materia', 'client.json')))
					.then(clientContent => {
						config.client = {
							www: clientContent.src
						};
						if (clientContent.src != clientContent.build) {
							config.client.packageJsonPath = clientContent.src;
							config.client.www = clientContent.build;
							config.scripts = clientContent.scripts ? config.scripts : {};
							if (clientContent.autoWatch) {
								config.autoWatch = clientContent.autoWatch;
							}
						}
					})
					.catch(() => {})
					.then(() => this.readJsonFile(join('.materia', 'addons.json')))
					.then(addonsContent => {
						config.addons = addonsContent;
					})
					.catch(() => {})
					.then(() => this.readJsonFile(join('.materia', 'gcloud.json')))
					.then(deploymentContent => {
						config.deployment = deploymentContent;
					})
					.catch(() => {})
					.then(() => {
						return new Promise((resolve, reject) => {
							const finalConfig = JSON.stringify(config, null, 4).replace('    ', '\t');
							const finalConfigProd = JSON.stringify(configProd, null, 4).replace('    ', '\t');
							this.app.logger.log('migration to do: ', finalConfig);
							fs.writeFile(join(this.app.path, 'materia.json'), finalConfig, err => {
								if (finalConfigProd) {
									fs.writeFile(join(this.app.path, 'materia.prod.json'), finalConfigProd, (error) => {
										this.app.logger.log(`Migration done for ${this.app.path} !`);
										this.app.config.reloadConfig();
										resolve();
									});
								} else {
									this.app.logger.log(`Migration done for ${this.app.path} !`);
									this.app.config.reloadConfig();
									resolve();
								}
							});
						});
					});
			});
	}

	check(): Promise<any> {
		return this.checkMigrate_0_8().then(migrate => {
			if (migrate) {
				this.app.logger.warn('Application Successfully migrated from v0.8 to v1.0');
			}
		});
	}
}