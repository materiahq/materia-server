import * as fse from 'fs-extra';
import * as path from 'path';
import { IClientConfig } from '@materia/interfaces';

import { App, AppMode, ConfigType } from '../../lib';
import { Npx } from '../lib/npx';
import { getPackageJson } from '../lib/getPackageJson';
import { WebsocketInstance } from '../../lib/websocket';

import { AngularCli } from '../lib/angular-cli';
import { VueCli } from '../lib/vue-cli';
import { ReactScripts } from '../lib/react-scripts';
import { PackageManager } from '../../lib/package-manager';

export class BoilerplateController {
	npx: Npx;
	angularCli: AngularCli;
	vueCli: VueCli;
	reactScripts: ReactScripts;
	packageManager: PackageManager;

	constructor(private app: App, websocket: WebsocketInstance) {
		this.packageManager = new PackageManager(this.app.path);
		this.npx = new Npx(this.app);
		this.angularCli = new AngularCli(this.app);
		this.vueCli = new VueCli(this.app);
		this.reactScripts = new ReactScripts(this.app);
	}

	initMinimal(req, res) {
		this.app.watcher.disable();
		this.app.initializeStaticDirectory()
			.then(() => {
				const clientConfig: IClientConfig = {
					www: 'client'
				};
				this.app.config.set(clientConfig, AppMode.DEVELOPMENT, ConfigType.CLIENT);
				return this.app.config.save();
			})
			.then(() => {
				this.app.watcher.enable();
				res.status(200).json({ init: true });
			})
			.catch((err) => {
				this.app.watcher.enable();
				res.status(500).send(err.message);
			});
	}

	initBoilerplate(req, res) {
		const framework = req.params.framework;
		switch (framework) {
			case 'angular':
				return this.initAngular(req, res);
			case 'react':
				return this.initReact(req, res);
			case 'vue':
				return this.initVue(req, res);
			default:
				res.status(500).send(new Error(`'${framework}' framework not supported`));
		}
	}

	initAngular(req, res) {
		this._checkFolderParams(req.body).then(params => {
			res.status(200).send();
			if (params && params.type === 'monopackage') {
				this.initAngularMonoPackage(params);
			} else {
				this.initDefaultAngular(params);
			}
		}).catch(err => res.status(500).send(err.message));
	}

	initDefaultAngular(params: { type: string, output: string, name: string }) {
		this._emitMessage('Install @angular/cli');

		this.app.watcher.disable();
		return this._installBoilerplateCli('@angular/cli').then(() => {
			this._emitMessage('Generate angular project');
			this.app.config.packageJson['scripts']['ng'] = 'ng';
			this.app.config.save();
			return this._newAngularProject(['--routing', '--style=scss'], params.name);
		}).then(() => {
			return this._removeItemIfExists(path.join(this.app.path, params.name, '.git'));
		}).then(() => {
			this._emitMessage('Rename angular project folder');
			return this._moveItem(path.join(this.app.path, params.name), path.join(this.app.path, params.output));
		}).then(() => {
			this._emitMessage('Build angular application');
			return this.angularCli.exec('build', [], path.join(this.app.path, params.output));
		}).then(() => {
			const boilerplateProjectPath = path.join(this.app.path, params.output);
			return this._fileToJson(path.join(boilerplateProjectPath, 'package.json'));
		}).then((angularPackageJson: any) => {
			angularPackageJson.scripts.watch = 'ng build --watch';
			angularPackageJson.scripts.prod = 'ng build --prod';
			return this.app.saveFile(path.join(this.app.path, params.output, 'package.json'), JSON.stringify(angularPackageJson, null, 2));
		}).then(() => {
			const clientConfig: IClientConfig = {
				packageJsonPath: params.output,
				www: `${params.output}/dist/${params.name}`,
				build: true,
				scripts: {
					build: 'build',
					watch: 'watch',
					prod: 'prod'
				},
				autoWatch: false
			};
			this.app.config.set(clientConfig, AppMode.DEVELOPMENT, ConfigType.CLIENT);
			return this.app.config.save();
		}).then(() => {
			this.app.server.dynamicStatic.setPath(path.join(this.app.path, `${params.output}/dist/${params.name}`));

			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.materiaApi.websocket.broadcast({ type, client: client });
			this.app.watcher.enable();

		}).catch(err => this._emitError(err));
	}

	initAngularMonoPackage(params) {
		this._emitMessage('Install @angular/cli');

		this.app.watcher.disable();
		return this._installBoilerplateCli('@angular/cli').then(() => {
			this._emitMessage('Generate angular project');
			this.app.config.packageJson['scripts']['ng'] = 'ng';
			this.app.config.save();
			return this._newAngularProject(['--style=scss', '--routing', '--skip-install'], params.name);
		}).then(() => {
			this._emitMessage('Construct monopackage structure');
			return this._mergeAngularPackage(params.name);
		}).then(() => {
			return this._removeBoilerplatePackage(params.name);
		}).then(() => {
			return this._removeItemIfExists(path.join(this.app.path, params.name, 'readme.md'));
		}).then(() => {
			return this._removeItemIfExists(path.join(this.app.path, params.name, '.git'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, '.gitignore'), path.join(this.app.path, '.gitignore2'));
		}).then(() => {
			return this._mergeBoilerplateProjectFolder(params.name);
		}).then(() => {
			return this._renameBoilerplateClientFolder();
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'e2e'), path.join(this.app.path, 'client', 'e2e'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'tslint.json'), path.join(this.app.path, 'client', 'tslint.json'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, '.editorconfig'), path.join(this.app.path, 'client', '.editorconfig'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'tsconfig.json'), path.join(this.app.path, 'client', 'tsconfig.json'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'tsconfig.app.json'), path.join(this.app.path, 'client', 'tsconfig.app.json'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, 'tsconfig.spec.json'), path.join(this.app.path, 'client', 'tsconfig.spec.json'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, '.gitignore'), path.join(this.app.path, 'client', '.gitignore'));
		}).then(() => {
			return this._moveItem(path.join(this.app.path, '.gitignore2'), path.join(this.app.path, '.gitignore'));
		}).then(() => {
			return this.angularCli.initNewMonopackageConfig(params.name);
		}).then(() => {
			return this.angularCli.saveConfig();
		}).then(() => {
			this._emitMessage('Install dependencies');
			return this.packageManager.installAll();
		}).then(() => {
			this._emitMessage('Build angular application');
			return this.angularCli.exec('build', []);
		}).then(() => {
			const clientConfig: IClientConfig = {
				www: 'client/dist',
				build: true,
				scripts: {
					build: 'build',
					watch: 'watch',
					prod: 'prod'
				},
				autoWatch: false
			};
			this.app.config.set(clientConfig, AppMode.DEVELOPMENT, ConfigType.CLIENT);
			return this.app.config.save();
		}).then(() => {
			this.app.server.dynamicStatic.setPath(path.join(this.app.path, 'client/dist'));

			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.materiaApi.websocket.broadcast({ type, client: client });
			this.app.watcher.enable();
		}).catch(err => this._emitError(err));
	}

	initReact(req, res) {
		let params;
		return this._checkFolderParams(req.body).then((modifiedParams) => {
			res.status(200).send();
			this.app.watcher.disable();
			params = modifiedParams;
			this._emitMessage('Create React application');
			return this.npx.exec('create-react-app', [
				params.name
			]).then(() => {
				this._emitMessage('Rename React app folder');
				return this._moveItem(path.join(this.app.path, params.name), path.join(this.app.path, params.output));
			}).then(() => {
				this._emitMessage('Add client config');
				const clientConfig: IClientConfig = {
					packageJsonPath: params.output,
					www: `${params.output}/build`,
					build: true,
					scripts: {
						build: 'build',
						prod: 'build'
					},
					autoWatch: false
				};
				this.app.config.set(clientConfig, AppMode.DEVELOPMENT, ConfigType.CLIENT);
				return this.app.config.save();
			}).then(() => {
				this._emitMessage('Build React application');
				return this.packageManager.runScript('build', path.join(this.app.path, params.output));
			}).then(() => {
				this.app.server.dynamicStatic.setPath(path.join(this.app.path, `${params.output}/build`));
				const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
				const type = 'boilerplate:success';
				this.app.watcher.enable();
				this.app.materiaApi.websocket.broadcast({ type, client: client });
			}).catch(err => this._emitError(err));
		}).catch(err => res.status(500).send(err.message));
	}

	initVue(req, res) {
		this._checkFolderParams(req.body).then((params) => {
			res.status(200).send();
			if (params.type === 'monopackage') {
				this.initVueMonoPackage(params);
			} else {
				this.initDefaultVue(params);
			}
		}).catch(err => res.status(500).send(err.message));
	}

	initDefaultVue(params) {
		this.app.watcher.disable();
		this._emitMessage('Install @vue/cli');
		return this._installBoilerplateCli('@vue/cli')
			.then(() => {
				this.app.config.packageJson['scripts']['vue'] = 'vue';
				return this.app.config.save();
			}).then(() => {
				this._emitMessage('Generate Vue application');
				return this._newVueProject(params.name);
			}).then(() =>
				this._moveItem(path.join(this.app.path, params.name), path.join(this.app.path, params.output))
			).then(() => {
				this._emitMessage('Build vue application');
				return this.vueCli.execVueCliService('build', [], path.join(this.app.path, params.output));
			}).then(() => {
				const clientConfig: IClientConfig = {
					packageJsonPath: params.output,
					www: `${params.output}/dist`,
					build: true,
					scripts: {
						build: 'build',
						prod: 'build'
					},
					autoWatch: false
				};
				this.app.config.set(clientConfig, AppMode.DEVELOPMENT, ConfigType.CLIENT);
				this.app.server.dynamicStatic.setPath(path.join(this.app.path, params.output, 'dist'));
				return this.app.config.save();
			}).then(() => {
				const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
				const type = 'boilerplate:success';
				this.app.watcher.enable();
				this.app.materiaApi.websocket.broadcast({ type, client: client });
			}).catch(err => this._emitError(err));
	}

	initVueMonoPackage(params) {
		this.app.watcher.disable();
		this._emitMessage('Install @vue/cli');
		return this._installBoilerplateCli('@vue/cli')
		.then(() => {
			this.app.config.packageJson['scripts']['vue'] = 'vue';
			return this.app.config.save();
		}).then(() => {
			return this._moveItem(path.join(this.app.path, '.gitignore'), path.join(this.app.path, '.gitignore2'));
		}).then(() => {
			this._emitMessage('Generate Vue application');
			return this._newVueProject(params.name);
		}).then(() =>
			this._mergeVuePackage(params.name)
		).then(() => {
			this._emitMessage('Generate monopackage structure');
			return this._removeBoilerplatePackage(params.name);
		})
		.then(() => this._removeBoilerplateNodeModules(params.name))
		.then(() => this._mergeBoilerplateProjectFolder(params.name))
		.then(() => {
			this._emitMessage('Create vue config file');
			return this.app.saveFile(path.join(this.app.path, 'vue.config.js'), `module.exports = {
configureWebpack: {
	entry: "./client/src/main.js"
},
outputDir: './client/dist'
}`);
		}).then(() =>
			this._moveItem(path.join(this.app.path, 'src'), path.join(this.app.path, 'client', 'src'))
		).then(() =>
			this._moveItem(path.join(this.app.path, 'public'), path.join(this.app.path, 'client', 'public'))
		).then(() =>
			this._moveItem(path.join(this.app.path, '.gitignore'), path.join(this.app.path, 'client', '.gitignore'))
		).then(() =>
			this._moveItem(path.join(this.app.path, '.gitignore2'), path.join(this.app.path, '.gitignore'))
		).then(() => {
			this._emitMessage('Install dependencies');
			return this.packageManager.installAll();
		}).then(() => {
			this._emitMessage('Build vue application');
			return this.vueCli.execVueCliService('build', []);
		}).then(() => {
			const clientConfig: IClientConfig = {
				www: 'client/dist',
				build: true,
				scripts: {
					build: 'build',
					prod: 'build'
				},
				autoWatch: false
			};
			this.app.config.set(clientConfig, AppMode.DEVELOPMENT, ConfigType.CLIENT);
			this.app.server.dynamicStatic.setPath(path.join(this.app.path, 'client/dist'));
			return this.app.config.save();
		}).then(() => {
			const client = this.app.config.get(AppMode.DEVELOPMENT, ConfigType.CLIENT);
			const type = 'boilerplate:success';
			this.app.watcher.enable();
			this.app.materiaApi.websocket.broadcast({ type, client: client });
		}).catch(err => this._emitError(err));
	}

	private _emitMessage(message) {
		const type = 'boilerplate';
		this.app.materiaApi.websocket.broadcast({ type, message: message });
	}

	private _emitError(err) {
		this.app.watcher.enable();
		const type = 'boilerplate:error';
		this.app.materiaApi.websocket.broadcast({ type, message: err });
	}

	private _checkFolderParams(params): Promise<any> {
		if ( ! params.name ) {
			params.name = this.app.config.packageJson.name;
		}
		if ( ! params.output ) {
			params.output = 'client';
		}
		if (fse.existsSync(path.join(this.app.path, params.name))) {
			return Promise.reject(new Error(`The folder '${path.join(this.app.path, params.name)}' already exists.`));
		}
		if (fse.existsSync(path.join(this.app.path, params.output))) {
			return Promise.reject(new Error(`The output folder '${path.join(this.app.path, params.output)}' already exists.`));
		}
		return Promise.resolve(params);
	}

	private _fileToJson(filePath) {
		return fse.readFile(filePath, 'utf-8').then(data => JSON.parse(data));
	}

	private async _installBoilerplateCli(name) {
		await this.packageManager.install(name);
		const tmp = await getPackageJson(this.app, name);
		const pkg = this.app.config.packageJson;
		if ( ! pkg['scripts']) {
			pkg['scripts'] = {};
		}
		if ( ! pkg['dependencies']) {
			pkg['dependencies'] = {};
		}
		if ( ! pkg['devDependencies']) {
			pkg['devDependencies'] = {};
		}
		pkg['devDependencies'][name] = `~${tmp['version']}`;
		this.app.config.packageJson = pkg;
		return this.app.config.save();
	}

	private _mergeAngularPackage(projectName) {
		return new Promise((resolve, reject) => {
			const pkg = this.app.config.packageJson;
			const boilerplateProjectPath = path.join(this.app.path, projectName);
			this._fileToJson(path.join(boilerplateProjectPath, 'package.json'))
				.then((boilerplateProjectPackage: any) => {
					delete boilerplateProjectPackage.scripts.start;
					this.app.config.set(
						Object.assign({}, pkg.devDependencies, boilerplateProjectPackage.devDependencies), AppMode.DEVELOPMENT, ConfigType.DEPENDENCIES
					);
					this.app.config.set(
						Object.assign({}, pkg.dependencies, boilerplateProjectPackage.dependencies), AppMode.PRODUCTION, ConfigType.DEPENDENCIES
					);
					this.app.config.set(
						Object.assign(
							{},
							pkg.scripts,
							boilerplateProjectPackage.scripts,
							{ watch: 'ng build --watch', prod: 'ng build --prod' }),
							this.app.mode, ConfigType.SCRIPTS
					);
					this.app.config.save();
					resolve();
				}).catch(err => reject(err));
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
						.catch(error => reject(error));
				}
			});
		});
	}

	private _mergeVuePackage(projectName) {
		const pkg = this.app.config.packageJson;
		const boilerplateProjectPath = path.join(this.app.path, projectName);
		return this._fileToJson(path.join(boilerplateProjectPath, 'package.json')).then((boilerplateProjectPackage: any) => {
			this.app.config.set(
				Object.assign({}, pkg.devDependencies, boilerplateProjectPackage.devDependencies), AppMode.DEVELOPMENT, ConfigType.DEPENDENCIES
			);
			this.app.config.set(
				Object.assign({}, pkg.dependencies, boilerplateProjectPackage.dependencies), AppMode.PRODUCTION, ConfigType.DEPENDENCIES
			);
			this.app.config.set(
				Object.assign(
					{},
					pkg.scripts,
					boilerplateProjectPackage.scripts,
					{ 'vue-cli-service': 'vue-cli-service' }
				),
				this.app.mode,
				ConfigType.SCRIPTS
			);
			this.app.config.packageJson = Object.assign({},
				this.app.config.packageJson,
				{
					eslintConfig: boilerplateProjectPackage.eslintConfig,
					postcss: boilerplateProjectPackage.postcss,
					browsersList: boilerplateProjectPackage.browsersList
				}
			);
			return this.app.config.save();
		});
	}

	private _moveItem(oldPath, newPath): Promise<void> {
		return fse.move(oldPath, newPath);
	}

	private _newAngularProject(params: string[], projectName?: string) {
		return this.angularCli.exec('new', [
			projectName ? projectName : this.app.config.packageJson.name,
			...params
		]);
	}

	private _newVueProject(projectName) {
		return this.vueCli.execVue('create', [
			projectName,
			'--git=false',
			'--default'
		]);
	}

	private _renameBoilerplateClientFolder(): Promise<void> {
		return fse.copy(path.join(this.app.path, 'src'), path.join(this.app.path, 'client', 'src'))
			.then(() => fse.remove(path.join(this.app.path, 'src')));
	}

	private _removeBoilerplatePackage(projectName?: string): Promise<void> {
		return fse.remove(path.join(this.app.path, projectName ? projectName : this.app.config.packageJson.name, 'package.json'));
	}

	private _removeBoilerplateNodeModules(projectName?: string): Promise<void> {
		return fse.remove(path.join(this.app.path, projectName ? projectName : this.app.config.packageJson.name, 'node_modules'));
	}

	private _removeOldBoilerplateProjectDirectory(projectPath): Promise<void> {
		return fse.remove(projectPath);
	}

	private _removeItemIfExists(itemPath): Promise<void> {
		if (fse.existsSync(itemPath)) {
			return fse.remove(path.join(itemPath));
		}
		return Promise.resolve();
	}
}