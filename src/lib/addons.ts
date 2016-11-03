'use strict';

import * as fs from 'fs'
import * as path from 'path'

import * as mkdirp from 'mkdirp'
import * as rmdir from 'rimraf'

import * as async from 'async'

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

//Not used yet... waiting for real support of these language
export enum SupportedLanguage {
	JAVASCRIPT,
	TYPESCRIPT,
	COFFEESCRIPT
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
	rootDirectory: string
	addonsConfig: any

	constructor(private app: App) {
		this.addons = []
		this.addonsObj = {}
		this.rootDirectory = path.join(this.app.path, 'addons')
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

	private _searchInstalledAddons():Promise<Array<string>> {
		return new Promise((resolve, reject) => {
			fs.readdir(path.join(this.app.path, 'addons'), (err, files) => {
				if (err && err.code == 'ENOENT') {
					return resolve([])
				}
				else if (err) {
					return reject(err)
				}
				else if (files && files.length) {
                    let addons = []
                    files.forEach(file => {
                        //add only directories
                        if (fs.lstatSync(path.join(this.app.path, 'addons', file)).isDirectory()) {
                            addons.push(file)
                        }
                    })
                    return resolve(addons);
                }
				else {
					return resolve([])
				}
			})
		})
	}

	private _loadConfig():Promise<any> {
		return new Promise((resolve, reject) => {
			fs.exists(path.join(this.app.path, 'addons.json'), exists => {
				if ( ! exists) {
					return resolve()
				}
				fs.readFile(path.join(this.app.path, 'addons.json'), 'utf8', (err, data) => {
					if ( err ) {
						return reject(err)
					}
					this.addonsConfig = JSON.parse(data)
					return resolve(this.addonsConfig)
				})
			})
		})
	}

	/**
	Load all addons in the `addons/` directory
	@returns Promise<void>
	*/
	load():Promise<void> {
		return this._loadConfig().then(config => {
			return this._searchInstalledAddons()
		}).then(addonsName => {
			return this._initializeAll(addonsName)
		}).then(addons => {
			this.addons = addons

			let p = Promise.resolve()

			this.addons.forEach(addon => {
				p = p.then(() => {
					console.log('addon', addon);
					if (typeof addon.obj.load == 'function') {
						let obj = addon.obj.load()
						if (this._isPromise(obj)) { // promise-like simple test
							return obj
						}
					}
					return Promise.resolve()
				}).then(() => {
					return this._loadEntities(addon.name)
				}).then(() => {
					return this._loadAPI(addon.name)
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
		if (fs.exists(path.join(this.app.path, 'addons', name))) {
			return Promise.reject(new Error('The addon already exists: ' + name))
		}
	}

	create(name:string, description:string, options?: IAddonOptions):Promise<void> {
		return this._checkName(name).then(() => {
			return new Promise((resolve, reject) => {
				mkdirp(path.join(this.app.path, 'addons', name), (err) => {
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
  "author": {
    "name": "you@domain.com"
  },
  "dependencies": {
  },
  "description": ${JSON.stringify(description || '')},
  "devDependencies": {},
  "license": "MIT",
  "main": "index.js",
  "name": "${name}",
  "version": "0.1.0"
}`
					console.log('index.js created');
					fs.writeFileSync(path.join(this.app.path, 'addons', name, 'index.js'), content);
					fs.writeFileSync(path.join(this.app.path, 'addons', name, 'package.json'), contentPackageJson);
					resolve();
				})
			})
		})
	}

	checkInstalled() {
		if ( ! this.app.infos.addons)
			return

		let files
		try {
			files = fs.readdirSync(path.join(this.app.path, 'addons'))
		} catch (e) {
			if (e.code == 'ENOENT') {
				if (Object.keys(this.app.infos.addons).length == 0)
					return
				throw new Error('Missing addons, please run "materia addons install"')
			}
			throw e
		}

		for (let k in this.app.infos.addons) {
			let addon = /[^/]+$/.exec(k) as any
			addon = addon ? addon[0] : ""
			if (files.indexOf(addon) == -1) {
				throw new Error('Missing addon: ' + k + ', please run "materia addons install"')
			}
		}
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


	private _loadEntities(addon:string):Promise<any> {
		return this.app.entities.loadFromAddon(addon)
	}

	private _loadAPI(addon:string):Promise<void> {
		try {
			this.app.api.loadFromAddon(addon)
			return Promise.resolve()
		}
		catch (e) {
			return Promise.reject(e)
		}
	}

	private _initialize(addon:string):Promise<IAddon> {
		if (this._hasIndexFile(addon)) {
			let AddonClass, addonInstance, addonPackage
			try {
				addonPackage = require(path.join(this.rootDirectory, addon, 'package.json'))
				AddonClass = require(path.join(this.rootDirectory, addon))
			} catch (e) {
				let err = new Error('Impossible to require addon ' + addon) as any
				err.originalError = e
				return Promise.reject(err)
			}
			try {
				addonInstance = new AddonClass(this.app, this.addonsConfig[addon], this.app.server.expressApp)
			} catch(e) {
				let err = new Error('Impossible to create addon ' + addon) as any
				err.originalError = e
				return Promise.reject(err)
			}

			let version
			if (addonPackage._from) {
				let matches = /^.*(?:#(.*))$/.exec(addonPackage._from)
				if (matches)
					version = matches[1]
			}
			let config;
			try {
				config = require(path.join(this.rootDirectory, addon, 'install.json'))
			}
			catch (e) {
				console.log('Addon ' + addonPackage.name + ' not configured')
			}
			console.log('configuration file:', config);
			return Promise.resolve({
				name: addonPackage.name,
				path: path.join(this.rootDirectory, addon),
				info: {
					description: addonPackage.description,
					logo: addonPackage.materia && addonPackage.materia.logo,
					author: addonPackage.materia && addonPackage.materia.author,
					version: version
				},
				config: config,
				obj: addonInstance
			})

			//TODO: Check @bump - I'm not sure what it is..
			/*if (AddonClass.dependencies) {
				addonsWithDeps = []
				for (var dep of AddonClass.dependencies) {
					addonsWithDeps[addon].push(dep)
				}
				addonsWithDeps[addon].push(pushAddon)
			} else {
				addonsWithDeps[addon] = pushAddon
			}*/
		}
		else {
			Promise.reject(new Error(''))
		}
	}

	private _initializeAll(addons:Array<string>):Promise<Array<IAddon>> {
		let promises = []
		addons.forEach(addon => {
			promises.push(this._initialize(addon))
		})
		return Promise.all(promises)
	}

	private _hasIndexFile(addon:string):boolean {
		return fs.existsSync(path.join(this.rootDirectory, addon, 'index.coffee')) ||
			fs.existsSync(path.join(this.rootDirectory, addon, 'index.js')) ||
			fs.existsSync(path.join(this.rootDirectory, addon, 'index.ts')) ||
			fs.existsSync(path.join(this.rootDirectory, addon + '.js')) ||
			fs.existsSync(path.join(this.rootDirectory, addon + '.coffee')) ||
			fs.existsSync(path.join(this.rootDirectory, addon + '.ts'))
	}

	private _isPromise(obj:any):boolean {
		return obj && obj.then && obj.catch
			&& typeof obj.then === 'function'
			&& typeof obj.catch === 'function'
	}
}