import * as path from 'path';
import chalk from 'chalk';
import { IAddonsConfig } from '@materia/interfaces';

import { App } from './app';
import { Addon } from './addons/addon';
import { ConfigType } from './config';

/**
 * @class Addons
 * @classdesc
 * This class is used to manage your addons in a materia app.
 */
export class Addons {
	addons: Addon[];
	addonsObj: any;
	addonsConfig: IAddonsConfig;

	constructor(private app: App) {
		this.addons = [];
		this.addonsObj = {};
		this.addonsConfig = {};
	}


	/**
	Unload an addon by its name
	@returns void
	*/
	unload(pkg: string): void {
		this.addons.forEach((addon, i) => {
			if (addon.package == pkg) {
				this.addons.splice(i, 1);
			}
		});
	}

	/**
	 * Search if whether or not an addon is installed by its package name. It returns promise with a boolean value.
	 * @returns Promise<boolean>
	 */
	isInstalled(pkg: string): Promise<boolean> {
		return this.searchInstalledAddons().then((installedAddons) => {
			const installedAddon = installedAddons.find(addonPkg => addonPkg === pkg);
			return installedAddon ? true : false;
		});
	}

	setupModule(setup: (require: NodeRequire) => Promise<any>): Promise<any> {
		let current = path.resolve(this.app.path, 'node_modules');
		let old;
		let shifted = 0;
		const paths = [];
		while (current != old) {
			paths.unshift(current);
			shifted++;
			old = current;
			current = path.resolve(current, '..', '..', 'node_modules');
		}
		for (const p of paths) {
			module['paths'].unshift(p);
		}
		const done = () => {
			while (shifted-- > 0) {
				module['paths'].shift();
			}
		};
		let setup_p;
		try {
			setup_p = Promise.resolve(setup(require));
		} catch (e) {
			done();
			return Promise.reject(e);
		}
		return setup_p.catch((e) => {
			done();
			throw e;
		}).then((r) => {
			done();
			return r;
		});
	}

	/**
	 * Search installed addons in the current application. It returns an array of addon package name.
	 * @returns Promise<string[]>
	 */
	searchInstalledAddons(): Promise<Array<string>> {
		let pkg;
		try {
			const packageJsonPath = require.resolve(path.join(this.app.path, 'package.json'));
			if (require.cache[packageJsonPath]) {
				delete require.cache[packageJsonPath];
			}
			pkg = require(path.join(this.app.path, 'package.json'));
		} catch (e) {
			pkg = {
				dependencies: {},
				devDependencies: {}
			};
		}
		const addons = [];
		const dependencies = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
		const links = this.app.config.get<string[]>(this.app.mode, ConfigType.LINKS) || [];
		return this.setupModule(() => {
			new Set([...Object.keys(dependencies), ...links]).forEach(dep => {
				try {
					const dep_pkg = require(dep + '/package.json');
					if (dep_pkg.materia) {
						addons.push(dep);
					}
				} catch (e) {
					try {
						require(dep + '/materia.json');
						addons.push(dep);
					} catch (e2) {
					}
				}
			});
			return Promise.resolve(addons);
		});
	}

	loadConfig(): IAddonsConfig {
		this.addonsConfig = this.app.config.get(this.app.mode, ConfigType.ADDONS);
		return this.addonsConfig;
	}

	/**
	Load all addons in the `addons/` directory
	@returns Promise<void>
	*/
	loadAddons(): Promise<void> {
		const elapsedTimeAddons = new Date().getTime();
		this.loadConfig();
		return this.searchInstalledAddons().then(addonsPkg => {
			// let addons:Addon[] = []

			this.addons = [];
			const promises: Promise<void>[] = [];
			addonsPkg.forEach(pkg => {
				const addon = new Addon(this.app, pkg);
				this.addons.push(addon);
				promises.push(addon.loadFromApp());
			});
			return Promise.all(promises);
		}).then(() => {
			let p = Promise.resolve();
			this.app.logger.log(` └─${this.addons.length == 0 ? '─' : '┬'} Addons: ${chalk.bold(this.addons.length.toString())}`);
			this.addons.forEach(addon => {
				p = p.then(() => {
					this.app.logger.log(` │ └── ${chalk.bold(addon.package)}: ${chalk.bold(addon.enabled ? 'OK' : chalk.red('ERROR'))}`);
					if (this.addonsConfig && this.addonsConfig[addon.package] && this.addonsConfig[addon.package].disabled) {
						addon.enabled = false;
					}
					if (addon.obj && typeof addon.obj.load == 'function' && addon.enabled) {
						const obj = addon.obj.load();
						if (this._isPromise(obj)) {
							return obj;
						}
					}
					return Promise.resolve();
				});
			});

			return p.then(() =>
				this.app.logger.log(
					` │ └── ${chalk.green.bold('OK')} - Completed in ${chalk.bold(((new Date().getTime()) - elapsedTimeAddons).toString() + 'ms')}`
				)
			);
		});
	}

	setConfig(pkg: string, config: any) {
		if ( ! this.addonsConfig ) {
			this.addonsConfig = {};
		}

		this.addonsConfig[pkg] = config;

		this.app.config.set(this.addonsConfig, this.app.mode, ConfigType.ADDONS);
		return this.app.config.save();
	}

	start(): Promise<void> {
		let p = Promise.resolve();
		this.addons.forEach(addon => {
			p = p.then(() => {
				if (addon.enabled) {
					return addon.start();
				} else {
					return Promise.resolve();
				}
			});
		});

		return p.catch(e => {
			this.app.logger.error(e);
		});
	}

	/**
	Get all the registered filters' name
	@returns {Array<object>}
	*/
	findAll() { return this.addons; }

	/**
	Get a plugin object
	@param {string} - Addon's name
	@returns {object}
	*/
	get(pkg: string): Addon {
		return this.addons.find(addon => addon.package === pkg);
	}

	/**
	Get the registered addons count
	@returns {integer}
	*/
	getLength(): number {
		return this.addons.length;
	}

	loadFiles(): Promise<any> {
		let p = Promise.resolve();
		this.addons.forEach((addon) => {
			p = p.then(() => {
				if (addon.enabled) {
					return this.app.entities.loadFiles(addon);
				}
				return Promise.resolve();
			});
		});
		return p;
	}

	handleHook(name: string): Promise<any> {
		let p = Promise.resolve();
		this.addons.forEach(addon => {
			p = p.then(() => {
				if (addon.enabled && typeof addon[name] == 'function') {
					return addon[name]();
				}
				return Promise.resolve();
			});
		});
		return p;
	}

	loadEntities(): Promise<any> {
		return this.handleHook('beforeLoadEntities').then(() => {
			let p: Promise<any> = Promise.resolve();
			this.addons.forEach((addon) => {
				if (addon.enabled) {
					p = p.then(() => this.app.entities.loadEntities(addon));
				}
			});
			return p;
		}).then(() => {
			return this.handleHook('afterLoadEntities');
		});
	}

	loadQueries(): Promise<void> {
		return this.handleHook('beforeLoadQueries').then(() => {
			let p = Promise.resolve();
			this.addons.forEach((addon) => {
				p = p.then(() => {
					if (addon.enabled) {
						return this.app.entities.loadQueries(addon);
					} else {
						return Promise.resolve();
					}
				});
			});
			return p;
		}).then(() => {
			return this.handleHook('afterLoadQueries');
		});
	}

	loadActions(): Promise<void> {
		return this.handleHook('beforeLoadHooks').then(() => {
			let p = Promise.resolve();
			this.addons.forEach((addon) => {
				p = p.then(() => {
					if (addon.enabled) {
						return this.app.actions.load(addon);
					} else {
						return Promise.resolve();
					}
				});
			});
			return p;
		}).then(() => {
			return this.handleHook('afterLoadHooks');
		});
	}

	loadAPI(): Promise<void> {
		return this.handleHook('beforeLoadAPI').then(() => {
			let p = Promise.resolve();
			this.addons.forEach((addon) => {
				p = p.then(() => {
					if (addon.enabled) {
						return this.app.api.load(addon);
					} else {
						return Promise.resolve();
					}
				});
			});
			return p;
		}).then(() => {
			return this.handleHook('afterLoadAPI');
		});
	}

	private _isPromise(obj: any): boolean {
		return obj && obj.then && obj.catch
			&& typeof obj.then === 'function'
			&& typeof obj.catch === 'function';
	}
}