import * as fs from 'fs'
import * as path from 'path'

import * as mkdirp from 'mkdirp'
import * as rmdir from 'rimraf'

import App from './app'

export interface IAddonInfo {
	description: string,
	logo: string,
	author: string,
	version: string
}

export interface IAddon {
	name: string
	path: string
	info: IAddonInfo
	published?: any
	config: any
	obj: any
}

export interface IAddonOptions {

}

/**
 * @class Addons
 * @classdesc
 * This class is used to manage your addons in a materia app.
 */
export default class Addons {
	addons: IAddon[]
	addonsObj: any
	addonsConfig: any

	constructor(private app: App) {
		this.addons = []
		this.addonsObj = {}
		this.addonsConfig = {}
	}


	/**
	Unload an addon by its name
	@returns void
	*/
	unload(name:string):void {
		this.addons.forEach((addon, i) => {
			if (addon.name == name) {
				this.addons.splice(i, 1);
			}
		})
	}

	private _setupModule(setup:()=>Promise<any>):Promise<any> {
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
			setup_p = setup()
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

	private _searchInstalledAddons():Promise<Array<string>> {
		let pkg = require(path.join(this.app.path, 'package.json'))
		let addons = []
		let dependencies = pkg.dependencies || {}
		return this._setupModule(() => {
			for (let dep in dependencies) {
				try {
					let dep_pkg = require(dep + '/package.json')
					if (dep_pkg.materia) {
						addons.push(dep)
					}
				} catch(e) {
					console.error('nope,',e)
				}
			}
			return Promise.resolve(addons)
		})
	}

	private _loadConfig():Promise<any> {
		let pkg = require(path.join(this.app.path, 'package.json'))
		this.addonsConfig = pkg.materia.addons || {}
		return Promise.resolve(this.addonsConfig)
	}

	/**
	Load all addons in the `addons/` directory
	@returns Promise<void>
	*/
	loadAddons():Promise<void> {
		return this._loadConfig().then(config => {
			return this._searchInstalledAddons()
		}).then(addonsName => {
			return this._initializeAll(addonsName)
		}).then(addons => {
			this.addons = addons

			let p = Promise.resolve()
			this.addons.forEach(addon => {
				p = p.then(() => {
					if (typeof addon.obj.load == 'function') {
						let obj = addon.obj.load()
						if (this._isPromise(obj)) { // promise-like simple test
							return obj
						}
					}
					return Promise.resolve()
				})
			})

			return p
		})
	}

	private _checkName(name:string):Promise<void> {
		if ( ! name ) {
			return Promise.reject(new Error('A name is required to create an addon.'))
		}
		let regexp = /[a-zA-Z0-9][.a-zA-Z0-9-_]*/g
		if ( ! regexp.test(name)) {
			return Promise.reject(new Error('The addon name contains bad characters.'))
		}
		if (fs.exists(path.join(this.app.path, 'node_modules', name))) {
			return Promise.reject(new Error('The addon already exists: ' + name))
		}
	}

	create(name:string, description:string, options?: IAddonOptions):Promise<void> {
		return this._checkName(name).then(() => {
			return new Promise((resolve, reject) => {
				mkdirp(path.join(this.app.path, 'node_modules', name), (err) => {
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
				if (typeof addon.obj.start == 'function') {
					let startResult = addon.obj.start(addon.config)
					if (this._isPromise(startResult)) {
						return startResult
					}
				}
				return Promise.resolve()
			})
		})

		return p
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
	get(name):IAddon {
		let result:IAddon;

		this.addons.forEach(addon => {
			if (addon.name == name) {
				result = addon
			}
		})
		return result
	}

	/**
	Get the registered addons count
	@returns {integer}
	*/
	getLength():number {
		return this.addons.length
	}

	loadFiles():Promise<any> {
		let p = Promise.resolve()
		this.addons.forEach((addon) => {
			p = p.then(() => {
				return this.app.entities.loadFiles(addon)
			})
		})
		return p
	}

	loadEntities():Promise<any> {
		let p = Promise.resolve()
		this.addons.forEach((addon) => {
			p = p.then(() => {
				return this.app.entities.loadEntities(addon)
			})
		})
		return p
	}

	loadQueries():Promise<void> {
		let p = Promise.resolve()
		this.addons.forEach((addon) => {
			p = p.then(() => {
				return this.app.entities.loadQueries(addon)
			})
		})
		return p
	}

	loadAPI():Promise<void> {
		let p = Promise.resolve()
		this.addons.forEach((addon) => {
			p = p.then(() => {
				return this.app.api.load(addon)
			})
		})
		return p
	}

	private _initialize(addon:string):Promise<IAddon> {
		let AddonClass, addonInstance, addonPackage
		return this._setupModule(() => {
			let app_path, addon_app
			try {
				app_path = path.dirname(require.resolve(path.join(addon, 'package.json')))
				addon_app = new App(app_path, {})
			} catch (e) {
				let err = new Error('Impossible to initialize addon ' + addon) as any
				err.originalError = e
				return Promise.reject(err)
			}
			return addon_app.migration.check().then(() => {
				try {
					addonPackage = require(path.join(addon, 'package.json'))
					AddonClass = require(addon)
				} catch (e) {
					let err = new Error('Impossible to require addon ' + addon) as any
					err.originalError = e
					throw err
				}
				try {
					addonInstance = new AddonClass(this.app, this.addonsConfig[addon], this.app.server.expressApp)
				} catch(e) {
					let err = new Error('Impossible to create addon ' + addon) as any
					err.originalError = e
					throw err
				}

				let config;
				try {
					config = require(path.join(addon, 'install.json'))
				}
				catch (e) {
					this.app.logger.warn('Addon ' + addonPackage.name + ' not configured')
				}
				return {
					name: addonPackage.name,
					path: app_path,
					info: {
						description: addonPackage.description,
						logo: addonPackage.materia && addonPackage.materia.logo,
						author: addonPackage.materia && addonPackage.materia.author,
						version: addonPackage.version
					},
					config: config,
					obj: addonInstance
				}
			})
		})
	}

	private _initializeAll(addons:Array<string>):Promise<Array<IAddon>> {
		let promises = []
		addons.forEach(addon => {
			promises.push(this._initialize(addon))
		})
		return Promise.all(promises)
	}

	private _isPromise(obj:any):boolean {
		return obj && obj.then && obj.catch
			&& typeof obj.then === 'function'
			&& typeof obj.catch === 'function'
	}
}