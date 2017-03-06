import * as fs from 'fs'
import * as path from 'path'

import App from '../app'
import MateriaError from '../error'

export interface IAddonTag {
	id: string
}

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

	enabled = true

	constructor(private app: App, pkg) {
		this.package = pkg
	}

	loadFromApp() {
		let AddonClass, addonInstance, addonPackage
		return this.app.addons.setupModule((require) => {
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