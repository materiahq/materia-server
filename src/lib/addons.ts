import * as fs from 'fs';
import * as path from 'path';

import * as fse from 'fs-extra';
import chalk from 'chalk';

import { App,  } from './app';
import { MateriaError } from './error';
import { Addon } from './addons/addon';
import { ConfigType } from './config';


export interface IAddon {
	package: string
	name: string
	path: string
	config: any
	obj: any,
	description: string
	logo: string
	author: string
	version: string
	installed: boolean
	installing: boolean
	published?: any
}

export interface IAddonConfig {
	[name:string]: {
		[param_name:string]: any
	}
}

export interface IAddonOptions {

}

/**
 * @class Addons
 * @classdesc
 * This class is used to manage your addons in a materia app.
 */
export class Addons {
	addons: Addon[]
	addonsObj: any
	addonsConfig: IAddonConfig

	constructor(private app: App) {
		this.addons = []
		this.addonsObj = {}
		this.addonsConfig = {}
	}


	/**
	Unload an addon by its name
	@returns void
	*/
	unload(pkg:string):void {
		this.addons.forEach((addon, i) => {
			if (addon.package == pkg) {
				this.addons.splice(i, 1);
			}
		})
	}

	isInstalled(pkg:string) {

	}

	setupModule(setup:(require:NodeRequire)=>Promise<any>):Promise<any> {
		let current = path.resolve(this.app.path, 'node_modules')
		let old
		let shifted = 0
		let paths = []
		while (current != old) {
			paths.unshift(current)
			shifted++
			old = current
			current = path.resolve(current, '..', '..', 'node_modules')
		}
		for (let p of paths) {
			module['paths'].unshift(p)
		}
		let done = () => {
			while (shifted-- > 0) {
				module['paths'].shift()
			}
		}
		let setup_p
		try {
			setup_p = Promise.resolve(setup(require))
		} catch (e) {
			done()
			return Promise.reject(e)
		}
		return setup_p.catch((e) => {
			done()
			throw e
		}).then((r) => {
			done()
			return r
		})
	}

	/**
	 * Search installed addons in the current application. It returns an array of addon package name.
	 * @returns Promise<string[]>
	 */
	searchInstalledAddons():Promise<Array<string>> {
		let packageJsonPath = require.resolve(path.join(this.app.path, 'package.json'))
		if (require.cache[packageJsonPath]) {
			delete require.cache[packageJsonPath]
		}
		let pkg = require(path.join(this.app.path, 'package.json'))
		let addons = []
		let dependencies = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {})
		const links = this.app.config.get<string[]>(this.app.mode, ConfigType.LINKS) || [];
		console.log(`~~~~~~~~~ ${links}`)
		return this.setupModule(() => {
			new Set([...Object.keys(dependencies), ...links]).forEach(dep => {
				console.log('try dep', dep);
				try {
					let dep_pkg = require(dep + '/package.json')
					if (dep_pkg.materia) {
						addons.push(dep)
					}
				} catch(e) {
					try {
						require(dep + '/materia.json');
						addons.push(dep)
					} catch(e2) {
					}
				}
			});
			console.log('addons', addons);
			return Promise.resolve(addons)
		})
	}

	loadConfig():IAddonConfig {
		this.addonsConfig = this.app.config.get(this.app.mode, ConfigType.ADDONS)
		return this.addonsConfig;

		// let pkg = require(path.join(this.app.path, 'package.json'))
		// this.addonsConfig = pkg.materia && pkg.materia.addons || {}
		// try {
		// 	let p = path.join(this.app.path, '.materia', 'addons.json')
		// 	let addonsConfigPath = require.resolve(p)
		// 	if (require.cache[addonsConfigPath]) {
		// 		delete require.cache[addonsConfigPath]
		// 	}

		// 	let setup:IAddonConfig = require(p)
		// 	this.addonsConfig = Object.assign({}, this.addonsConfig, setup)
		// } catch(e) {
		// 	if (e.code != 'MODULE_NOT_FOUND') {
		// 		return Promise.reject(new MateriaError(`Error in .materia/addons.json`))
		// 	}
		// }
		// return Promise.resolve(this.addonsConfig)
	}

	/**
	Load all addons in the `addons/` directory
	@returns Promise<void>
	*/
	loadAddons():Promise<void> {
		const elapsedTimeAddons = new Date().getTime()
		this.loadConfig()
		return this.searchInstalledAddons().then(addonsPkg => {
			// let addons:Addon[] = []

			this.addons = []
			let promises:Promise<void>[] = []
			addonsPkg.forEach(pkg => {
				let addon = new Addon(this.app, pkg)
				this.addons.push(addon)
				promises.push(addon.loadFromApp())
			})
			return Promise.all(promises)
		}).then(() => {
			let p = Promise.resolve()
			this.app.logger.log(` └─${this.addons.length == 0 ? '─' : '┬'} Addons: ${chalk.bold(this.addons.length.toString())}`)
			this.addons.forEach(addon => {
				p = p.then(() => {
					this.app.logger.log(` │ └── ${chalk.bold(addon.package)}: ${chalk.bold(addon.enabled ? 'OK' : chalk.red('ERROR'))}`)
					if (this.addonsConfig && this.addonsConfig[addon.package] && this.addonsConfig[addon.package].disabled) {
						addon.enabled = false;
					}
					if (addon.obj && typeof addon.obj.load == 'function' && addon.enabled) {
						let obj = addon.obj.load()
						if (this._isPromise(obj)) {
							return obj
						}
					}
					return Promise.resolve()
				})
			})

			return p.then(() => this.app.logger.log(` │ └── ${chalk.green.bold("OK")} - Completed in ${chalk.bold(((new Date().getTime()) - elapsedTimeAddons).toString() + 'ms')}`))
		})
	}

	setConfig(pkg:string, config:any) {
		if ( ! this.addonsConfig ) {
			this.addonsConfig = {};
		}

		this.addonsConfig[pkg] = config

		this.app.config.set(this.addonsConfig, this.app.mode, ConfigType.ADDONS);
		return this.app.config.save()
		// let p = path.join(this.app.path, '.materia', 'addons.json')
		// let content = JSON.stringify(this.addonsConfig, null, 2)
		// return this.app.saveFile(p, content, {
		// 	mkdir: true
		// })
	}

	//OUT OF DATE
	private _checkName(name:string):Promise<void> {
		if ( ! name ) {
			return Promise.reject(new MateriaError('A name is required to create an addon.'))
		}
		let regexp = /[a-zA-Z0-9][.a-zA-Z0-9-_]*/g
		if ( ! regexp.test(name)) {
			return Promise.reject(new MateriaError('The addon name contains bad characters.'))
		}
		if (fs.existsSync(path.join(this.app.path, 'node_modules', name))) {
			return Promise.reject(new MateriaError('The addon already exists: ' + name))
		}
	}

	//OUT OF DATE
	create(name:string, description:string, options?: IAddonOptions):Promise<any> {
		return this._checkName(name).then(() => {
			return new Promise((resolve, reject) => {
				fse.mkdirp(path.join(this.app.path, 'node_modules', name), (err) => {
					if (err) {
						return reject(err)
					}
					let nameCapitalizeFirst = name.charAt(0).toUpperCase() + name.slice(1)

					//TODO: Get Git name & email for the package.json
					//TODO: Put these files in external template files (for readability)
					let content = `'use strict';

class ${nameCapitalizeFirst} {
	constructor(app, config) {
		//TODO
	}

	start() {
		//TODO
		return Promise.resolve()
	}
}

module.exports = ${nameCapitalizeFirst};`

				let contentPackageJson = `{
	"name": "${name}",
	"version": "0.1.0",
	"description": ${JSON.stringify(description || '')},
	"author": {
		"name": "you@domain.com"
	},
	"license": "MIT",
	"main": "index.js",
	"materia": {},
	"dependencies": {
	}
}`
					fs.writeFileSync(path.join(this.app.path, 'node_modules', name, 'index.js'), content);
					fs.writeFileSync(path.join(this.app.path, 'node_modules', name, 'package.json'), contentPackageJson);
					resolve();
				})
			})
		})
	}

	start():Promise<void> {
		let p = Promise.resolve()
		this.addons.forEach(addon => {
			p = p.then(() => {
				if (addon.enabled) {
					return addon.start()
				} else {
					return Promise.resolve();
				}
			})
		})

		return p.catch(e => {
			console.log(e);
		})
	}

	/**
	Get all the registered filters' name
	@returns {Array<object>}
	*/
	findAll() { return this.addons }

	/**
	Get a plugin object
	@param {string} - Addon's name
	@returns {object}
	*/
	get(pkg:string):Addon {
		return this.addons.find(addon => addon.package === pkg);
	}

	/**
	Get the registered addons count
	@returns {integer}
	*/
	getLength():number {
		return this.addons.length;
	}

	loadFiles():Promise<any> {
		let p = Promise.resolve()
		this.addons.forEach((addon) => {
			p = p.then(() => {
				if (addon.enabled) {
					return this.app.entities.loadFiles(addon);
				}
				else {
					return Promise.resolve();
				}
			})
		})
		return p;
	}

	handleHook(name:string):Promise<any> {
		let p = Promise.resolve()
		this.addons.forEach(addon => {
			p = p.then(() => {
				if (addon.enabled && typeof addon[name] == 'function') {
					return addon[name]();
				}
				else return Promise.resolve()
			})
		})
		return p
	}

	loadEntities():Promise<any> {
		return this.handleHook('beforeLoadEntities').then(() => {
			let p = Promise.resolve()
			this.addons.forEach((addon) => {
				p = p.then(() => {
					if (addon.enabled) {
						return this.app.entities.loadEntities(addon)
					} else {
						return Promise.resolve()
					}
				})
			})
			return p
		}).then(() => {
			return this.handleHook('afterLoadEntities')
		})
	}

	loadQueries():Promise<void> {
		return this.handleHook('beforeLoadQueries').then(() => {
			let p = Promise.resolve()
			this.addons.forEach((addon) => {
				p = p.then(() => {
					if (addon.enabled) {
						return this.app.entities.loadQueries(addon)
					} else {
						return Promise.resolve();
					}
				})
			})
			return p
		}).then(() => {
			return this.handleHook('afterLoadQueries')
		})
	}

	loadActions():Promise<void> {
		return this.handleHook('beforeLoadHooks').then(() => {
			let p = Promise.resolve()
			this.addons.forEach((addon) => {
				p = p.then(() => {
					if (addon.enabled) {
						return this.app.actions.load(addon)
					} else {
						return Promise.resolve();
					}
				})
			})
			return p
		}).then(() => {
			return this.handleHook('afterLoadHooks')
		})
	}

	loadAPI():Promise<void> {
		return this.handleHook('beforeLoadAPI').then(() => {
			let p = Promise.resolve()
			this.addons.forEach((addon) => {
				p = p.then(() => {
					if (addon.enabled) {
						return this.app.api.load(addon)
					} else {
						return Promise.resolve()
					}
				})
			})
			return p
		}).then(() => {
			return this.handleHook('afterLoadAPI')
		})
	}

	private _isPromise(obj:any):boolean {
		return obj && obj.then && obj.catch
			&& typeof obj.then === 'function'
			&& typeof obj.catch === 'function'
	}
}