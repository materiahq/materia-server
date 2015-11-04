'use strict';
var fs = require('fs')
var path = require('path')

module.exports = class Addons {
	constructor(app) {
		this.app = app
		this.addons = []
		this.rootDirectory = path.join(this.app.path, 'addons')
	}

	load() {
		this.addons = []
		try {
			//console.log '\nLoading relations:'
			let files = fs.readdirSync(path.join(this.app.path, 'addons'))
			console.log(files)

			let addonsConfig = {}
			if (fs.existsSync(path.join(this.app.path, 'addons.json'))) {
				let content = fs.readFileSync(path.join(this.app.path, 'addons.json'))
				addonsConfig = JSON.parse(content)
			}

			files.forEach((addon) => {
				//check addons installed
				if (fs.existsSync(path.join(this.rootDirectory, addon, 'index.coffee')) ||
					fs.existsSync(path.join(this.rootDirectory, addon, 'index.js')) ||
					fs.existsSync(path.join(this.rootDirectory, addon + '.js')) ||
					fs.existsSync(path.join(this.rootDirectory, addon + '.coffee'))) {
					//check config
					let addonInstance = require(path.join(this.rootDirectory, addon))
					this.add(addonInstance, addonsConfig[addon])
				}
				else {
					//throw 'could not load ' + addon.name
				}
			})
		}
		catch (e) {
			console.log('\nImpossible to load addons.json', e)
		}
	}

	getLength() {
		return this.addons.length
	}

	add(addon, config) {
		let a = new addon(this.app, config)
		this.addons.push(a)
		return a
	}
}
