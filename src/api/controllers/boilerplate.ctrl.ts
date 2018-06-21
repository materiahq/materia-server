import { App, AppMode, ConfigType } from '../../lib';
import { Npm } from '../lib/npm';
import { Npx } from '../lib/npx';
import { AngularCli } from '../lib/angular-cli';
import { VueCli } from '../lib/vue-cli';

import { getPackageJson } from '../lib/getPackageJson';
import { WebsocketInstance } from '../../lib/websocket';

import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as path from 'path';

export class BoilerplateController {
	npm: Npm;
	npx: Npx;
	angularCli: AngularCli;
	vueCli: VueCli

	constructor(private app: App, websocket: WebsocketInstance) {
		this.npm = new Npm(this.app);
		this.npx = new Npx(this.app);
		this.angularCli = new AngularCli(this.app);
		this.vueCli = new VueCli(this.app);
	}

	initMinimal(req, res) {
		this.app.initializeStaticDirectory();
		res.status(200).json({ init: true });
	}

	initAngular(req, res) {
		console.log('INSTALL @angular/cli');
		this._installBoilerplateCli('@angular/cli').then(() => {
			console.log('GENERATE NEW ANGULAR-CLI PROJECT IN CLIENT');
			this.app.config.packageJson['scripts']['ng'] = 'ng';
			this.app.config.save();
			this._newAngularProject().then(() => {
				console.log('Main angular project package merged with main package');
				console.log('Remove angular package.json');
				this._removeBoilerplatePackage().then(() => {
					console.log('Merge angular project folder with materia app folder');
					this._mergeBoilerplateProjectFolder().then(() => {
						console.log('Rename angular src folder to client/src');
						this._renameBoilerplateClientFolder().then(() => {
							console.log('Modify angular.json file');
							this.angularCli.initNewConfig().then(() => {
								this.angularCli.saveConfig().then(() => {
									console.log('Angular cli config ready');
									console.log('Install all dependencies...');
									this.npm.exec('install', []).then(() => {
										console.log('All dependencies installed !');
										console.log('BUILD ANGULAR APPLICATION');
										this.angularCli.exec('build', []).then(() => {
											console.log('BUILD DONE !');
											this.app.config.set({
												src: 'client/src',
												dist: 'client/dist',
												buildEnabled: true,
												scripts: {
													build: "build",
													watch: "watch",
													prod: "prod"
												},
												autoWatch: false
											}, AppMode.DEVELOPMENT, ConfigType.CLIENT)
											this.app.server.dynamicStatic.setPath(path.join(this.app.path, 'client/dist'));
											this.app.config.save();
											const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
											res.status(200).send(client);
										}).catch(err => res.status(500).send(err));
									}).catch(err => res.status(500).send(err));
								}).catch(err => res.status(500).send(err));
							}).catch(err => res.status(500).send(err));
						}).catch(err => res.status(500).send(err));
					}).catch(err => res.status(500).send(err));
				}).catch(err => res.status(500).send(err));
			}).catch(err => res.status(500).send(err));
		}).catch(err => res.status(500).send(err));
	}

	private _installBoilerplateCli(packageName) {
		return new Promise((resolve, reject) => {
			const name = packageName;
			this.npm.exec('install', [name, '--save']).then(data => {
				const pkg = this.app.config.packageJson
				if (!pkg['devDependencies']) {
					pkg['devDependencies'] = {};
				}
				if (!pkg['dependencies']) {
					pkg['dependencies'] = {};
				}
				if (!pkg['scripts']) {
					pkg['scripts'] = {};
				}
				getPackageJson(this.app, name).then(tmp => {
					pkg['devDependencies'][name] = `~${tmp['version']}`;
					this.app.config.packageJson = pkg;
					this.app.config.save();
					resolve();
				}).catch(err => reject(err));
			}).catch(err => reject(err));
		});
	}

	private _newAngularProject() {
		return new Promise((resolve, reject) => {
			this.angularCli.exec('new', [
				this.app.config.packageJson.name,
				'--style=scss',
				'--routing',
				'--skip-install'
			]).then(() => {
				this._mergeAngularPackage().then(() => resolve()).catch(err => reject(err))
			}).catch(err => reject(err));

		});
	}

	private _mergeAngularPackage() {
		return new Promise((resolve, reject) => {
			const pkg = this.app.config.packageJson
			const boilerplateProjectPath = path.join(this.app.path, this.app.config.packageJson.name);
			this._fileToJson(path.join(boilerplateProjectPath, 'package.json')).then((boilerplateProjectPackage: any) => {
				this.app.config.set(Object.assign({}, pkg.devDependencies, boilerplateProjectPackage.devDependencies), AppMode.DEVELOPMENT, ConfigType.DEPENDENCIES);
				this.app.config.set(Object.assign({}, pkg.dependencies, boilerplateProjectPackage.dependencies), AppMode.PRODUCTION, ConfigType.DEPENDENCIES);
				this.app.config.set(Object.assign({}, pkg.scripts, boilerplateProjectPackage.scripts, { watch: 'ng build --watch', prod: 'ng build --prod' }), this.app.mode, ConfigType.SCRIPTS);
				this.app.config.save();
				resolve();
			}).catch(err => reject(err));
		});
	}

	private _removeBoilerplatePackage() {
		return new Promise((resolve, reject) => {
			fs.unlink(path.join(this.app.path, this.app.config.packageJson.name, 'package.json'), (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
	private _removeBoilerplateNodeModules() {
		return new Promise((resolve, reject) => {
			fse.remove(path.join(this.app.path, this.app.config.packageJson.name, 'node_modules'), (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
	private _mergeBoilerplateProjectFolder() {
		return new Promise((resolve, reject) => {
			const projectPath = path.join(this.app.path, this.app.config.packageJson.name);
			fse.copy(projectPath, this.app.path, (err) => {
				if (err) {
					reject(err);
				} else {
					this._removeOldBoilerplateProjectDirectory(projectPath)
						.then(() => resolve())
						.catch(err => reject(err));
				}
			})
		});
	}

	private _renameBoilerplateClientFolder() {
		return new Promise((resolve, reject) => {
			fse.copy(path.join(this.app.path, 'src'), path.join(this.app.path, 'client', 'src'), (err) => {
				if (err) {
					console.log('Error copy src to client/src : ', err);
					reject(err);
				} else {
					fse.remove(path.join(this.app.path, 'src'), (err) => {
						if (err) {
							console.log('Error deleting src folder : ', err)
							reject(err)
						} else {
							resolve();
						}
					})
				}
			});
		});
	}

	private _removeOldBoilerplateProjectDirectory(projectPath) {
		return new Promise((resolve, reject) => {
			fse.remove(projectPath, (err) => {
				if (err) {
					reject(err);
				}
				resolve()
			});
		});

	}

	private _fileToJson(packagePath) {
		return new Promise((resolve, reject) => {
			fs.readFile(packagePath, 'utf-8', (e, data) => {
				if (e) {
					reject(e);
				} else {
					resolve(JSON.parse(data));
				}
			});
		});
	}

	initReact(req, res) {
		console.log('Create React App');
		this.npx.exec('create-react-app', [
			this.app.config.packageJson.name
		]).then(() => {
			console.log('React app created');
			console.log('BUILD REACT APP');
		})
		/*proc.stdout.on('data', data2 => {
			console.log(`child stdout:\n${data2}`);
		});
		proc.stderr.on('data', data2 => {
			console.error(`child stderr:\n${data2}`);
		});
		proc.on('exit', (code, signal) => {
			const buildProc: any = this.npm.spawn(['run', 'build'], {
				cwd: this.app.path + '/my-react-project'
			});
			buildProc.stdout.on('data', data2 => {
				console.log(`child stdout:\n${data2}`);
			});
			buildProc.stderr.on('data', data2 => {
				console.log(`child stderr:\n${data2}`);
			});
			buildProc.on('exit', (code2, signal2) => {
				console.log('BUILD SUCCESS');
				console.log('SET NEW CLIENT APP');*/
		// app.client.set(
		// 	'my-react-project',
		// 	'my-react-project/build',
		// 	{ build: 'build', watch: 'build', prod: 'build' },
		// 	false
		// );
		// const client = {
		// 	enabled: true,
		// 	build: {
		// 		src: 'my-react-project',
		// 		dist: 'my-react-project/build',
		// 		enabled: true
		// 	}
		// };
		// resolve(client);
		// });
	}

	initVue(req, res) {
		console.log('INSTALL @vue/cli');
		this._installBoilerplateCli('@vue/cli').then(() => {
			this.app.config.packageJson['scripts']['vue'] = 'vue';
			this.app.config.save();
			console.log('GENERATE new vue-cli project');
			this._newVueProject().then(() => {
				this._removeBoilerplatePackage().then(() => {
					this._removeBoilerplateNodeModules().then(() => {
						this._mergeBoilerplateProjectFolder().then(() => {
							console.log('Merge folder success');
							console.log('Creating Vue-cli config file');
							this.app.saveFile(path.join(this.app.path, 'vue.config.js'),`module.exports = {
								configureWebpack: {
									entry: "./client/src/main.js"
								},
								outputDir: './client/dist'
							  }`).then(() => {
								  console.log('Vue config file save');
								  this._moveVueFolders().then(() => {
									console.log('Install all dependencies...');
									this.npm.exec('install', []).then(() => {
										console.log('All dependencies installed !');
										this.vueCli.execVueCliService('build', []).then(() => {
											console.log('BUILD DONE !');
											this.app.config.set({
												src: 'client/src',
												dist: 'client/dist',
												buildEnabled: true,
												scripts: {
													build: "build",
													watch: "watch",
													prod: "prod"
												},
												autoWatch: false
											}, AppMode.DEVELOPMENT, ConfigType.CLIENT)
											this.app.server.dynamicStatic.setPath(path.join(this.app.path, 'client/dist'));
											this.app.config.save();
											const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
											res.status(200).send(client);
										}).catch(err => res.status(500).send(err));
									}).catch(err => res.status(500).send(err));
								}).catch(err => res.status(500).send(err));
							}).catch(err => res.status(500).send(err));
						}).catch(err => res.status(500).send(err));
					}).catch(err => res.status(500).send(err));
				}).catch(err => res.status(500).send(err));
			}).catch(err => res.status(500).send(err));
		}).catch(err => res.status(500).send(err));

	}

	private _moveVueFolders() {
		return new Promise((resolve, reject) => {
			fse.copy(path.join(this.app.path, 'src'), path.join(this.app.path, 'client', 'src'), (err) => {
				if (err) {
					console.log('Error copy src to client/src : ', err);
					reject(err);
				} else {
					fse.remove(path.join(this.app.path, 'src'), (err) => {
						if (err) {
							console.log('Error deleting src folder : ', err)
							reject(err)
						} else {
							fse.copy(path.join(this.app.path, 'public'), path.join(this.app.path, 'client', 'public'), (err) => {
								if (err) {
									console.log('Error copy src to client/src : ', err);
									reject(err);
								} else {
									fse.remove(path.join(this.app.path, 'public'), (err) => {
										if (err) {
											console.log('Error deleting src folder : ', err)
											reject(err)
										} else {
											resolve();
										}
									})
								}
							});
						}
					})
				}
			});
		});
	}

	private _newVueProject() {
		return new Promise((resolve, reject) => {
			this.vueCli.execVue('create', [
				this.app.config.packageJson.name,
				'--git=false',
				'--default'
			]).then(() => {
				this._mergeVuePackage().then(() => resolve()).catch(err => reject(err))
			}).catch(err => reject(err));

		});
	}


	private _mergeVuePackage() {
		return new Promise((resolve, reject) => {
			const pkg = this.app.config.packageJson
			const boilerplateProjectPath = path.join(this.app.path, this.app.config.packageJson.name);
			this._fileToJson(path.join(boilerplateProjectPath, 'package.json')).then((boilerplateProjectPackage: any) => {
				this.app.config.set(Object.assign({}, pkg.devDependencies, boilerplateProjectPackage.devDependencies), AppMode.DEVELOPMENT, ConfigType.DEPENDENCIES);
				this.app.config.set(Object.assign({}, pkg.dependencies, boilerplateProjectPackage.dependencies), AppMode.PRODUCTION, ConfigType.DEPENDENCIES);
				this.app.config.set(Object.assign({}, pkg.scripts, boilerplateProjectPackage.scripts, { watch: 'ng build --watch', prod: 'ng build --prod' }), this.app.mode, ConfigType.SCRIPTS);
				this.app.config.packageJson = Object.assign({},
					this.app.config.packageJson,
					{
						eslintConfig: boilerplateProjectPackage.eslintConfig,
						postcss: boilerplateProjectPackage.postcss,
						browsersList: boilerplateProjectPackage.browsersList
					}
				)
				this.app.config.save();
				resolve();
			}).catch(err => reject(err));
		});
	}
}