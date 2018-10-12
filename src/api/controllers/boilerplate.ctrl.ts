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
		this.npm = new Npm(this.app.path);
		this.npx = new Npx(this.app);
		this.angularCli = new AngularCli(this.app);
		this.vueCli = new VueCli(this.app);
		this.reactScripts = new ReactScripts(this.app);
	}

	initMinimal(req, res) {
		this.app.initializeStaticDirectory()
			.then(() => res.status(200).json({ init: true }))
			.catch((err) => res.status(500).send(err.message));
	}

	private _emitMessage(message) {
		const type = "boilerplate"
		this.app.materiaApi.websocket.broadcast({ type, message: message })
	}

	private _emitError(err) {
		const type = "boilerplate:error"
		this.app.materiaApi.websocket.broadcast({ type, message: err.data })
	}

	initAngular(req, res) {
		res.status(200).send({});
		if (req.body && req.body.type === 'monopackage') {
			this.initAngularMonoPackage(req.body);
		} else {
			this.initDefaultAngular(req.body);
		}
	}

	initDefaultAngular(params: { type: string, output: string, name: string }) {
		this._emitMessage('install @angular/cli');

		this.app.watcher.disable();
		return this._installBoilerplateCli('@angular/cli').then(() => {
			this._emitMessage('Generate angular project')
			this.app.config.packageJson['scripts']['ng'] = 'ng';
			this.app.config.save();
			return this._newAngularProject(params.name)
		}).then(() => {
			this._emitMessage('Rename angular project folder')
			return this._renameItem(path.join(this.app.path, params.name), path.join(this.app.path, params.output))
		}).then(() => {
			this._emitMessage('Build angular application')
			return this.angularCli.execInFolder(params.output, 'build', [])
		}).then(() => {
			this.app.config.set({
				src: params.output,
				dist: `${params.output}/dist/${params.name}`,
				buildEnabled: true,
				scripts: {
					build: "build",
					watch: "watch",
					prod: "prod"
				},
				autoWatch: false
			}, AppMode.DEVELOPMENT, ConfigType.CLIENT);
			return this.app.config.save();
		}).then(() => {
			this.app.server.dynamicStatic.setPath(path.join(this.app.path, `${params.output}/dist/${params.name}`));

			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.materiaApi.websocket.broadcast({ type, client: client })
			this.app.watcher.enable();

		}).catch(err => this._emitError(err));
	}

	initAngularMonoPackage(params) {
		this._emitMessage('install @angular/cli');

		this.app.watcher.disable();
		return this._installBoilerplateCli('@angular/cli').then(() => {
			this._emitMessage('generate angular project')
			this.app.config.packageJson['scripts']['ng'] = 'ng';
			this.app.config.save();
			return this._newAngularMonoPackageProject(params.name)
		}).then(() => {
			this._emitMessage('construct monopackage structure')
			return this._removeBoilerplatePackage(params.name)
		}).then(() => {
			return this._renameItem(path.join(this.app.path, '.gitignore'), path.join(this.app.path, '.gitignore2'))
		}).then(() => {
			return this._mergeBoilerplateProjectFolder(params.name)
		}).then(() => {
			return this._renameBoilerplateClientFolder()
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'e2e'), path.join(this.app.path, 'client', 'e2e'))
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'tslint.json'), path.join(this.app.path, 'client', 'tslint.json'))
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'tsconfig.json'), path.join(this.app.path, 'client', 'tsconfig.json'))
		}).then(() => {
			return this._moveItem(path.join(this.app.path, '.gitignore'), path.join(this.app.path, 'client', '.gitignore'))
		}).then(() => {
			return this._renameItem(path.join(this.app.path, '.gitignore2'), path.join(this.app.path, '.gitignore'))
		}).then(() => {
			return this.angularCli.initNewMonopackageConfig(params.name)
		}).then(() => {
			return this.angularCli.saveConfig()
		}).then(() => {
			this._emitMessage('Install dependencies')
			return this.npm.exec('install', [])
		}).then(() => {
			this._emitMessage('Build angular application')
			return this.angularCli.exec('build', [])
		}).then(() => {
			this.app.config.set({
				src: '',
				dist: 'client/dist',
				buildEnabled: true,
				scripts: {
					build: "build",
					watch: "watch",
					prod: "prod"
				},
				autoWatch: false
			}, AppMode.DEVELOPMENT, ConfigType.CLIENT);
			return this.app.config.save();
		}).then(() => {
			this.app.server.dynamicStatic.setPath(path.join(this.app.path, 'client/dist'));

			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.materiaApi.websocket.broadcast({ type, client: client })
			this.app.watcher.enable();
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

	private _newAngularProject(projectName?: string) {
		return this.angularCli.exec('new', [
			projectName ? projectName : this.app.config.packageJson.name,
			'--style=scss',
			'--routing'
		]);
	}

	private _newAngularMonoPackageProject(projectName?: string) {
		const name = projectName ? projectName : this.app.config.packageJson.name;
		return this.angularCli.exec('new', [
			name,
			'--style=scss',
			'--routing',
			'--skip-install'
		]).then(() =>
			this._mergeAngularPackage(name)
		);
	}

	private _mergeAngularPackage(projectName) {
		return new Promise((resolve, reject) => {
			const pkg = this.app.config.packageJson
			const boilerplateProjectPath = path.join(this.app.path, projectName);
			this._fileToJson(path.join(boilerplateProjectPath, 'package.json')).then((boilerplateProjectPackage: any) => {
				this.app.config.set(Object.assign({}, pkg.devDependencies, boilerplateProjectPackage.devDependencies), AppMode.DEVELOPMENT, ConfigType.DEPENDENCIES);
				this.app.config.set(Object.assign({}, pkg.dependencies, boilerplateProjectPackage.dependencies), AppMode.PRODUCTION, ConfigType.DEPENDENCIES);
				this.app.config.set(Object.assign({}, pkg.scripts, boilerplateProjectPackage.scripts, { watch: 'ng build --watch', prod: 'ng build --prod' }), this.app.mode, ConfigType.SCRIPTS);
				this.app.config.save();
				resolve();
			}).catch(err => reject(err));
		});
	}

	private _removeBoilerplatePackage(projectName?: string) {
		return new Promise((resolve, reject) => {
			fs.unlink(path.join(this.app.path, projectName ? projectName : this.app.config.packageJson.name, 'package.json'), (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
	private _removeBoilerplateNodeModules(projectName?: string) {
		return new Promise((resolve, reject) => {
			fse.remove(path.join(this.app.path, projectName ? projectName : this.app.config.packageJson.name, 'node_modules'), (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}
	private _mergeBoilerplateProjectFolder(projectName?: string) {
		return new Promise((resolve, reject) => {
			const projectPath = path.join(this.app.path, projectName ? projectName : this.app.config.packageJson.name);
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

	private _moveItem(oldPath, newPath) {
		return new Promise((resolve, reject) => {
			return fse.move(oldPath, newPath, (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			})
		});
	}

	private _renameItem(oldPath, newPath): Promise<void> {
		return new Promise((resolve, reject) => {
			fs.rename(path.join(oldPath), path.join(newPath), (err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
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
		const params = req.body;
		if (! params.name) {
			params.name = this.app.config.packageJson.name;
		}
		if (! params.output) {
			params.output = 'client';
		}
		this._emitMessage('Create React application')
		return this.npx.exec('create-react-app', [
			params.name
		])
			.then(() => {
				this._emitMessage('Rename React app folder')
				return this._renameItem(path.join(this.app.path, params.name), path.join(this.app.path, params.output));
			}).then(() => {
				this._emitMessage('Add client config')
				this.app.config.set({
					src: params.output,
					dist: `${params.output}/build`,
					buildEnabled: true,
					scripts: {
						build: "build",
						watch: "watch",
						prod: "prod"
					},
					autoWatch: false
				}, AppMode.DEVELOPMENT, ConfigType.CLIENT)
				this._emitMessage('Add scripts to root package.json')
				if (!this.app.config.packageJson['scripts']) {
					this.app.config.packageJson['scripts'] = {};
				}
				this.app.config.packageJson['scripts']['build'] = "cd client && npm run build";
				this.app.config.packageJson['scripts']['prod'] = "cd client && npm run build";
				return this.app.config.save();
			}).then(() => {
				this._emitMessage('Build React application')
				return this.npm.execInFolder(params.output, 'run-script', ['build'])
			}).then(() => {
				this.app.server.dynamicStatic.setPath(path.join(this.app.path, `${params.output}/build`));
				const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
				const type = 'boilerplate:success';
				this.app.watcher.enable();
				this.app.materiaApi.websocket.broadcast({ type, client: client })
			}).catch(err => this._emitError(err));
	}

	initVue(req, res) {
		res.status(200).send({});
		if (req.body.type === 'monopackage') {
			this.initVueMonoPackage(req.body);
		} else {
			this.initDefaultVue(req.body);
		}
	}

	initDefaultVue(params) {

		if (! params.name) {
			params.name = this.app.config.packageJson.name;
		}
		if (! params.output) {
			params.output = 'client';
		}
		this.app.watcher.disable();
		this._emitMessage('Install @vue/cli')
		return this._installBoilerplateCli('@vue/cli')
			.then(() => {
				this.app.config.packageJson['scripts']['vue'] = 'vue';
				return this.app.config.save();
			}).then(() => {
				this._emitMessage('Generate Vue application')
				return this._newVueProject(params.name);
			}).then(() =>
				this._renameItem(path.join(this.app.path, params.name), path.join(this.app.path, params.output))
			).then(() => {
				this._emitMessage('Build vue application')
				return this.vueCli.execVueCliServiceInFolder(params.output, 'build', [])
			}).then(() => {
				this.app.config.set({
					src: params.output,
					dist: `${params.output}/dist`,
					buildEnabled: true,
					scripts: {
						build: "build",
						prod: "build"
					},
					autoWatch: false
				}, AppMode.DEVELOPMENT, ConfigType.CLIENT)
				this.app.server.dynamicStatic.setPath(path.join(this.app.path, params.output, 'dist'));
				return this.app.config.save();
			}).then(() => {
				const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
				const type = 'boilerplate:success';
				this.app.materiaApi.websocket.broadcast({ type, client: client })
			}).catch(err => this._emitError(err));
	}

	initVueMonoPackage(params) {
		this.app.watcher.disable();
		this._emitMessage('Install @vue/cli')

		if (! params.name) {
			params.name = this.app.config.packageJson.name;
		}

		return this._removeItemIfExist(path.join(this.app.path, 'package-lock.json'))
			.then(() => this._removeItemIfExist(path.join(this.app.path, 'yarn.lock')))
			.then(() => this._removeItemIfExist(path.join(this.app.path, 'node_modules')))
			.then(() => this._installBoilerplateCli('@vue/cli'))
			.then(() => {
				this.app.config.packageJson['scripts']['vue'] = 'vue';
				return this.app.config.save();
			}).then(() => {
				this._emitMessage('Generate Vue application')
				return this._newVueMonoPackageProject(params.name);
			}).then(() => {
				this._emitMessage('Generate monopackage structure')
				return this._removeBoilerplatePackage(params.name)
			})
			.then(() => this._removeBoilerplateNodeModules(params.name))
			.then(() => this._mergeBoilerplateProjectFolder(params.name))
			.then(() => {
				this._emitMessage('Create vue config file')
				return this.app.saveFile(path.join(this.app.path, 'vue.config.js'), `module.exports = {
	configureWebpack: {
		entry: "./client/src/main.js"
	},
	outputDir: './client/dist'
}`)
			}).then(() => this._moveVueFolders())
			.then(() => {
				this._emitMessage('Install dependencies')
				return this.npm.exec('install', [])
			}).then(() => {
				this._emitMessage('Build vue application')
				return this.vueCli.execVueCliService('build', [])
			}).then(() => {
				this.app.config.set({
					src: '',
					dist: 'client/dist',
					buildEnabled: true,
					scripts: {
						build: "build",
						prod: "build"
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

	private _newVueProject(projectName) {
		return this.vueCli.execVue('create', [
			projectName,
			'--git=false',
			'--default'
		]);
	}

	private _newVueMonoPackageProject(projectName) {
		return this.vueCli.execVue('create', [
			this.app.config.packageJson.name,
			'--git=false',
			'--default'
		]).then(() =>
			this._mergeVuePackage(projectName)
		);
	}


	private _mergeVuePackage(projectName) {
		const pkg = this.app.config.packageJson
		const boilerplateProjectPath = path.join(this.app.path, projectName);
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