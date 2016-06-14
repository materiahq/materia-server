'use strict';

var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var rmdir = require('rimraf')

var async = require('async')

/**
 * @class Addons
 * @classdesc
 * This class is used to manage your addons in a materia app.
 */
class Addons {
	constructor(app) {
		this.app = app
		this.addons = []
		this.addonsObj = {}
		this.rootDirectory = path.join(this.app.path, 'addons')
		this.addonsConfig = {}
	}

	_requireAndCreateAddons(files, callback) {
		let addonsWithDeps = {}
		for (let addon of files) {
			if (fs.existsSync(path.join(this.rootDirectory, addon, 'index.coffee')) ||
				fs.existsSync(path.join(this.rootDirectory, addon, 'index.js')) ||
				fs.existsSync(path.join(this.rootDirectory, addon + '.js')) ||
				fs.existsSync(path.join(this.rootDirectory, addon + '.coffee'))) {
				(() => {
					let AddonClass, addonInstance, addonPackage
					try {
						addonPackage = require(path.join(this.rootDirectory, addon, 'package.json'))
						AddonClass = require(path.join(this.rootDirectory, addon))
					} catch (e) {
						let err = new Error('Impossible to require addon ' + addon)
						err.originalError = e
						return callback(err)
					}
					try {
						addonInstance = new AddonClass(this.app, this.addonsConfig[addon])
					} catch(e) {
						let err = new Error('Impossible to create addon ' + addon)
						err.originalError = e
						return callback(e)
					}

					let version
					if (addonPackage._from) {
						let matches = /^.*(?:#(.*))$/.exec(addonPackage._from)
						if (matches)
							version = matches[1]
					}

					let pushAddon = (callback) => callback(null, this.addons.push({
						name: addonPackage.name,
						path: path.join(this.rootDirectory, addon),
						info: {
							description: addonPackage.description,
							logo: addonPackage.materia && addonPackage.materia.logo,
							author: addonPackage.materia && addonPackage.materia.author,
							version: version
						},
						obj: addonInstance
					}))
					if (AddonClass.dependencies) {
						addonsWithDeps = []
						for (var dep of AddonClass.dependencies) {
							addonsWithDeps[addon].push(dep)
						}
						addonsWithDeps[addon].push(pushAddon)
					} else {
						addonsWithDeps[addon] = pushAddon
					}
				})()
			}
		}

		async.auto(addonsWithDeps, callback)
	}

	createCustom(name, description) {
		return new Promise((accept, reject) => {
			if ( ! name ) {
				return reject({
					error: true,
					message: 'A name is required to create an addon.',
				})
			}
			let regexp = /[a-zA-Z0-9][.a-zA-Z0-9-_]*/g
			if ( ! regexp.test(name)) {
				return reject({
					error: true,
					message: 'The addon name contains bad characters.',
				})
			}
			if (fs.exists(path.join(this.app.path, 'addons', name))) {
				return reject({
					error: true,
					message: 'The addon already exists: ' + name,
				})
			}
			mkdirp(path.join(this.app.path, 'addons', name), (err) => {
				if (err) {
					return reject(err)
				}
				let nameCapitalizeFirst = name.charAt(0).toUpperCase() + name.slice(1)
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
				accept();
			})
		})
	}

	unload(name) {
		for (let i in this.addons) {
			let addon = this.addons[i];
			if (addon.name == name) {
				this.addons.splice(i, 1);
				return
			}
		}
	}

	load() {
		this.addons = []
		this.addonsObj = {}

		return new Promise((accept, reject) => {
			let files
			try {
				files = fs.readdirSync(path.join(this.app.path, 'addons'))
			} catch (e) {
				if (e.code == 'ENOENT')
					return accept()
				return reject(e)
			}

			if (fs.existsSync(path.join(this.app.path, 'addons.json'))) {
				let content = fs.readFileSync(path.join(this.app.path, 'addons.json'))
				this.addonsConfig = JSON.parse(content.toString())
			}

			this._requireAndCreateAddons(files, (err) => {
				if (err)
					return reject(err)
				let p = Promise.resolve()
				for (let addon of this.addons) {
					this.addonsObj[addon.name] = addon
					;((addon) => {
						p = p.then(() => {
							if (typeof addon.obj.load == 'function') {
								let obj = addon.obj.load()
								if (obj && obj.then && obj.catch
									&& typeof obj.then === 'function'
									&& typeof obj.catch === 'function') { // promise-like simple test
									return obj
								}
							}
							return Promise.resolve()
						})
					})(addon)
				}

				p.then(() => {
					accept()
				}).catch((err) => {
					reject(err)
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
			let addon = /[^/]+$/.exec(k)
			addon = addon ? addon[0] : ""
			if (files.indexOf(addon) == -1) {
				throw new Error('Missing addon: ' + k + ', please run "materia addons install"')
			}
		}
	}

	start() {
		let p = Promise.resolve()
		for (let addon of this.addons) {
			((addon) => {
				p = p.then(() => {
					if (typeof addon.obj.start == 'function') {
						let obj = addon.obj.start()
						if (obj && obj.then && obj.catch
							&& typeof obj.then === 'function'
							&& typeof obj.catch === 'function') { // promise-like simple test
							return obj
						}
					}
					return Promise.resolve()
				})
			})(addon)
		}

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
	get(name) { return this.addonsObj[name] }

	/**
	Get the registered addons count
	@returns {integer}
	*/
	getLength() {
		return this.addons.length
	}
}

module.exports = Addons