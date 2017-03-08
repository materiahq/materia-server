import * as fs from 'fs'
import * as path from 'path'

import App from '../app'
import MateriaError from '../error'

export interface IAddonInfo {
	package?: string
	name: string
	description: string
	logo: string
	author: string
	version: string
	tags: IAddonTag[]
	color: string
}

export interface IAddonTag {
	id: string
}

export interface IAddonSetup {
	name: string
	description: string
	default: any
	type: string
	component?: string
}

export default class Addon {
	package: string

	path: string
	config: any
	obj: any

	name: string
	description: string
	logo: string
	author: string
	version: string
	tags: IAddonTag[]

	color: string

	installed: boolean
	installing: boolean
	published: any

	setupConfig: any[]

	enabled = true

	constructor(private app: App, pkg) {
		this.package = pkg
	}

	loadFromApp() {
		let AddonClass, addonInstance, addonPackage
		return this.app.addons.setupModule(require => {
			let addon_app
			try {
				this.path = path.dirname(require.resolve(path.join(this.package, 'package.json')))
				addon_app = new App(this.path, {})
			} catch (e) {
				return Promise.reject(new MateriaError('Impossible to initialize addon ' + this.package, {
					originalError: e
				}))
			}
			return addon_app.migration.check().then(() => {
				try {
					addonPackage = require(path.join(this.package, 'package.json'))
					AddonClass = require(this.package)
				} catch (e) {
					throw new MateriaError('Impossible to require addon ' + this.package, {
						originalError: e
					})
				}
				try {
					addonInstance = new AddonClass(this.app, this.app.addons.addonsConfig[this.package], this.app.server.expressApp)
				} catch(e) {
					throw new MateriaError('Impossible to instantiate addon ' + this.package, {
						originalError: e
					})
				}

				this.package = addonPackage.name,
				this.name = addonPackage.materia && addonPackage.materia.display_name || addonPackage.name,
				this.description = addonPackage.description,
				this.logo = addonPackage.materia && addonPackage.materia.logo,
				this.author = addonPackage.materia && addonPackage.materia.author,
				this.version = addonPackage.version,
				this.color = addonPackage.materia && addonPackage.materia.icon && addonPackage.materia.icon.color,
				this.tags = addonPackage.keywords && addonPackage.keywords.map(keyword => {
					return {id: keyword}
				}) || []

				this.config = this.app.addons.addonsConfig[this.package]
				this.obj = addonInstance;

				this.installed = true
				this.installing = false
				return Promise.resolve()
			})
		})
	}

	loadFromData(data) {
		this.name = data.name
		this.description = data.description
		this.logo = data.logo
		this.author = data.author
		this.version = data.version
		this.tags = data.tags
		this.color = data.color
	}

	start() {
		if (typeof this.obj.start == 'function') {
			let startResult = this.obj.start()
			if (this._isPromise(startResult)) {
				return startResult
			}
		}
		return Promise.resolve()
	}

	setup(config:any):Promise<any> {
		console.log('in setup', config);
		this.config = config
		return this.app.addons.setConfig(this.package, config)
	}

	getSetupConfig():Promise<any> {
		return this.app.addons.setupModule(require => {
			let setupObj
			try {
				console.log('try to get path')
				let packageJsonPath = require.resolve(path.join(this.package, 'package.json'))
				console.log('clear cache if exists')
				if (require.cache[packageJsonPath]) {
					delete require.cache[packageJsonPath]
				}
				console.log('require')
				let pkgJson = require(path.join(this.package, 'package.json')).materia
				console.log('get setup', pkgJson, pkgJson.setup, Array.isArray(pkgJson && pkgJson.setup))
				if ( ! Array.isArray(pkgJson && pkgJson.setup)) {
					return Promise.resolve([])
				}
				return Promise.resolve(pkgJson.setup)
			} catch(e) {
				console.log('error', e, e.stack)
				return Promise.reject(e)
			}
		})
	}

	//TODO
	disable() {

	}

	//TODO
	enable() {

	}

	toJson():IAddonInfo {
		return {
			package: this.package,
			name: this.name,
			description: this.description,
			logo: this.logo,
			version: this.version,
			tags: this.tags,
			author: this.author,
			color: this.color
		}
	}
	private _isPromise(obj:any):boolean {
		return obj && obj.then && obj.catch
			&& typeof obj.then === 'function'
			&& typeof obj.catch === 'function'
	}
}