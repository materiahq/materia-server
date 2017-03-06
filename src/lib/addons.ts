import * as fs from 'fs'
import * as path from 'path'

import * as fse from 'fs-extra'

import App from './app'
import MateriaError from './error'
import Addon from './addons/addon'


export interface IAddon {
	package: string
	name: string
	path: string
	config: any
	obj: any
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
export default class Addons {
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
		return this.setupModule(() => {
			for (let dep in dependencies) {
				try {
					let dep_pkg = require(dep + '/package.json')
					if (dep_pkg.materia) {
						addons.push(dep)
					}
				} catch(e) {
				}
			}
			return Promise.resolve(addons)
		})
	}

	loadConfig():Promise<IAddonConfig> {
		let pkg = require(path.join(this.app.path, 'package.json'))
		this.addonsConfig = pkg.materia && pkg.materia.addons || {}
		try {
			let setup:IAddonConfig = require(path.join(this.app.path, '.materia/addons.json'))
			this.addonsConfig = Object.assign({}, this.addonsConfig)
			for (let k in setup) {
				if (this.addonsConfig[k]) {
					this.addonsConfig[k] = Object.assign(this.addonsConfig[k], setup[k])
				} else {
					this.addonsConfig[k] = setup[k]
				}
			}
		} catch(e) {
			if (e.code != 'MODULE_NOT_FOUND') {
				return Promise.reject(new MateriaError(`Error in .materia/addons.json`))
			}
		}
		return Promise.resolve(this.addonsConfig)
	}

	/**
	Load all addons in the `addons/` directory
	@returns Promise<void>
	*/
	loadAddons():Promise<void> {
		return this.loadConfig().then(config => {
			return this.searchInstalledAddons()
		}).then(addonsName => {
			let addons:Addon[] = []

			this.addons = []
			let promises:Promise<void>[] = []
			addonsName.forEach(addonName => {
				let addon = new Addon(this.app, addonName)
				this.addons.push(addon)
				promises.push(addon.loadFromApp())
			})
			return Promise.all(promises)
		}).then(addons => {
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

	//OUT OF DATE
	private _checkName(name:string):Promise<void> {
		if ( ! name ) {
			return Promise.reject(new MateriaError('A name is required to create an addon.'))
		}
		let regexp = /[a-zA-Z0-9][.a-zA-Z0-9-_]*/g
		if ( ! regexp.test(name)) {
			return Promise.reject(new MateriaError('The addon name contains bad characters.'))
		}
		if (fs.exists(path.join(this.app.path, 'node_modules', name))) {
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
			p = p.then(() => addon.start())
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
	get(pkg:string):Addon {
		let result;
		this.addons.forEach(addon => {
			if (addon.package == pkg) {
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

	private _isPromise(obj:any):boolean {
		return obj && obj.then && obj.catch
			&& typeof obj.then === 'function'
			&& typeof obj.catch === 'function'
	}
}