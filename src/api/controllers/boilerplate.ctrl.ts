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
import { ReactScripts } from '../lib/react-scripts';

export class BoilerplateController {
	npm: Npm;
	npx: Npx;
	angularCli: AngularCli;
	vueCli: VueCli
	reactScripts: ReactScripts;

	constructor(private app: App, websocket: WebsocketInstance) {
		this.npm = new Npm(this.app);
		this.npx = new Npx(this.app);
		this.angularCli = new AngularCli(this.app);
		this.vueCli = new VueCli(this.app);
		this.reactScripts = new ReactScripts(this.app);
	}

	initMinimal(req, res) {
		this.app.initializeStaticDirectory();
		res.status(200).json({ init: true });
	}

	private _emitMessage(message) {
		const type = "boilerplate"
		this.app.materiaApi.websocket.broadcast({ type, message: message })
	}

	private _emitError(err) {
		const type = "boilerplate:error"
		this.app.materiaApi.websocket.broadcast({ type, error: err })
	}

	initAngular(req, res) {
		res.status(200).send({});

		this._emitMessage('install @angular/cli');

		this.app.watcher.disable();
		return this._installBoilerplateCli('@angular/cli').then(() => {
			this._emitMessage('generate angular project')
			this.app.config.packageJson['scripts']['ng'] = 'ng';
			this.app.config.save();
			return this._newAngularProject()
		}).then(() => {
			this._emitMessage('construct monopackage structure')
			return this._removeBoilerplatePackage()
		}).then(() => {
			return this._mergeBoilerplateProjectFolder()
		}).then(() => {
			return this._renameBoilerplateClientFolder()
		}).then(() => {
			return this.angularCli.initNewConfig()
		}).then(() => {
			return this.angularCli.saveConfig()
		}).then(() => {
			this._emitMessage('Install dependencies')
			return this.npm.exec('install', [])
		}).then(() => {
			this._emitMessage('Build angular application')
			return this.angularCli.exec('build', [])
		}).then(() => {
			return this.app.config.set({
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
		}).then(() => {
			this.app.server.dynamicStatic.setPath(path.join(this.app.path, 'client/dist'));

			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.materiaApi.websocket.broadcast({ type, client: client })
			this.app.watcher.enable();
			// res.status(200).send(client);
		}).catch(err => this._emitError(err));
	}

	private _installBoilerplateCli(packageName) {
		return new Promise((resolve, reject) => {
			const name = packageName;
			this.npm.exec('install', [name, '--save']).then(data => {
				const pkg = this.app.config.packageJson
				if (!pkg['scripts']) {
					pkg['scripts'] = {};
				}
				if (!pkg['dependencies']) {
					pkg['dependencies'] = {};
				}
				if (!pkg['devDependencies']) {
					pkg['devDependencies'] = {};
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
		return this.angularCli.exec('new', [
			this.app.config.packageJson.name,
			'--style=scss',
			'--routing',
			'--skip-install'
		]).then(() =>
			this._mergeAngularPackage()
		);
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
					reject(err);
				} else {
					fse.remove(path.join(this.app.path, 'src'), (err) => {
						if (err) {
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

	private _removeItemIfExist(itemPath) {
		return new Promise((resolve, reject) => {
			if (fs.existsSync(itemPath)) {
				fse.remove(path.join(itemPath), (err) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			} else {
				resolve();
			}
		});
	}

	initReact(req, res) {
		res.status(200).send({});
		this.app.watcher.disable();
		this._emitMessage('Create React application')
		return this.npx.exec('create-react-app', [
			this.app.config.packageJson.name
		]).then(() => {
			this._emitMessage('Generate monopackage structure')
			return this._mergeReactPackage()
		}).then(() => {
			return this._removeBoilerplatePackage()
		}).then(() => this._removeBoilerplateNodeModules())
		.then(() => this._mergeBoilerplateProjectFolder())
		.then(() => {
			this._emitMessage('Install all dependencies')
			return this._removeItemIfExist(path.join(this.app.path, 'yarn.lock'))
		}).then(() =>
			this._removeItemIfExist(path.join(this.app.path, 'node_modules'))
		).then(() => this.npm.exec('install', []))
		.then(() => {
			this._emitMessage('Build React application')
			return this.reactScripts.exec('build', [])
		}).then(() => {
			this.app.config.set({
				src: 'src',
				dist: 'build',
				buildEnabled: true,
				scripts: {
					build: "build",
					watch: "watch",
					prod: "prod"
				},
				autoWatch: false
			}, AppMode.DEVELOPMENT, ConfigType.CLIENT)
			this.app.server.dynamicStatic.setPath(path.join(this.app.path, 'build'));
			return this.app.config.save();
		}).then(() => {
			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.watcher.enable();
			this.app.materiaApi.websocket.broadcast({ type, client: client })
		}).catch(err => this._emitError(err))
	}

	private _mergeReactPackage() {
		const pkg = this.app.config.packageJson
		const boilerplateProjectPath = path.join(this.app.path, this.app.config.packageJson.name);
		return this._fileToJson(path.join(boilerplateProjectPath, 'package.json')).then((boilerplateProjectPackage: any) => {
			this.app.config.set(Object.assign({}, pkg.devDependencies, boilerplateProjectPackage.devDependencies), AppMode.DEVELOPMENT, ConfigType.DEPENDENCIES);
			this.app.config.set(Object.assign({}, pkg.dependencies, boilerplateProjectPackage.dependencies), AppMode.PRODUCTION, ConfigType.DEPENDENCIES);
			this.app.config.set(Object.assign({}, pkg.scripts, boilerplateProjectPackage.scripts), this.app.mode, ConfigType.SCRIPTS);
			return this.app.config.save();
		})
	}

	initVue(req, res) {
		res.status(200).send({});
		this.app.watcher.disable();
		this._emitMessage('Install @vue/cli')
		return this._installBoilerplateCli('@vue/cli').then(() => {
			this.app.config.packageJson['scripts']['vue'] = 'vue';
			return this.app.config.save();
		}).then(() => {
			this._emitMessage('Generate Vue application')
			return this._newVueProject();
		}).then(() => {
			this._emitMessage('Generate monopackage structure')
			return this._removeBoilerplatePackage()
		})
		.then(() => this._removeBoilerplateNodeModules())
		.then(() => this._mergeBoilerplateProjectFolder())
		.then(() => {
			this._emitMessage('Create vue config file')
			return this.app.saveFile(path.join(this.app.path, 'vue.config.js'), `module.exports = {
	configureWebpack: {
		entry: "./client/src/main.js"
	},
	outputDir: './client/dist'
}`)
		}).then(() => this._moveVueFolders())
		.then(() => this._removeItemIfExist(path.join(this.app.path, 'package-lock.json')))
		.then(() => this._removeItemIfExist(path.join(this.app.path, 'yarn.lock')))
		.then(() => this._removeItemIfExist(path.join(this.app.path, 'node_modules')))
		.then(() => {
			this._emitMessage('Install dependencies')
			return this.npm.exec('install', [])
		}).then(() => {
			this._emitMessage('Build vue application')
			return this.vueCli.execVueCliService('build', [])
		}).then(() => {
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
			return this.app.config.save();
		}).then(() => {
			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.materiaApi.websocket.broadcast({ type, client: client })
		}).catch(err => this._emitError(err));
	}

	private _moveVueFolders() {
		return new Promise((resolve, reject) => {
			fse.copy(path.join(this.app.path, 'src'), path.join(this.app.path, 'client', 'src'), (err) => {
				if (err) {
					reject(err);
				} else {
					fse.remove(path.join(this.app.path, 'src'), (err) => {
						if (err) {
							reject(err)
						} else {
							fse.copy(path.join(this.app.path, 'public'), path.join(this.app.path, 'client', 'public'), (err) => {
								if (err) {
									reject(err);
								} else {
									fse.remove(path.join(this.app.path, 'public'), (err) => {
										if (err) {
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
		const pkg = this.app.config.packageJson
		const boilerplateProjectPath = path.join(this.app.path, this.app.config.packageJson.name);
		return this._fileToJson(path.join(boilerplateProjectPath, 'package.json')).then((boilerplateProjectPackage: any) => {
			this.app.config.set(Object.assign({}, pkg.devDependencies, boilerplateProjectPackage.devDependencies), AppMode.DEVELOPMENT, ConfigType.DEPENDENCIES);
			this.app.config.set(Object.assign({}, pkg.dependencies, boilerplateProjectPackage.dependencies), AppMode.PRODUCTION, ConfigType.DEPENDENCIES);
			this.app.config.set(Object.assign({}, pkg.scripts, boilerplateProjectPackage.scripts, { "vue-cli-service": "vue-cli-service" }), this.app.mode, ConfigType.SCRIPTS);
			this.app.config.packageJson = Object.assign({},
				this.app.config.packageJson,
				{
					eslintConfig: boilerplateProjectPackage.eslintConfig,
					postcss: boilerplateProjectPackage.postcss,
					browsersList: boilerplateProjectPackage.browsersList
				}
			)
			return this.app.config.save();
		})
	}
}