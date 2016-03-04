'use strict'

let fs = require('fs')
let Handlebars = require('handlebars')

const filesNeeded = {
	'dockerfile': [
		'Dockerfile.hbs',
		'docker-compose.yml.hbs'
	],
	'heroku': [
		'app.json.hbs',
		'docker-compose.yml.hbs',
		'Dockerfile.hbs',
		'Procfile',
		'package.json.hbs',
		'README.md.hbs'
	]
}

class Deploy {
	constructor(app) {
		this.app = app

		this._templates_dir = this.app.materia_path + "/../templates/deploy/"
	}

	_generateFile(file, infos) {
		let content = fs.readFileSync(this._templates_dir + file).toString()
		let matches = /^(.+)\.hbs$/.exec(file)

		let use_hbs = false
		let filename
		if ( ! matches) {
			filename = file
		} else {
			filename = matches[1]
			use_hbs = true
		}

		if (use_hbs) {
			let tmpl = Handlebars.compile(content)
			content = tmpl(infos)
		}

		fs.writeFileSync(this.app.path + '/' + filename, content)

		console.log("Wrote file", filename)
	}

	generate(provider, _options) {
		console.log("TODO: check exec heroku, heroku create (or select app / params), install addon heroku docker")

		let options = {}
		for (let i in _options) {
			options[i] = _options[i]
		}

		options.mode = options.mode || "prod"

		let infos = {
			instance: {
				image_base: 'node:5.6',
				use_runnable: true,
				port: this.app.server.getConfig(options.mode).port
			},
			app: {
				name: this.app.name,
				description: this.app.name,
				author: this.app.name
			},
			env_vars: options.env_vars
		}

		if (provider == 'heroku') {
			// TODO: fork and manage our own heroku-nodejs base image
			infos.instance.image_base = "binarytales/heroku-nodejs:5.6.0"
			infos.instance.use_runnable = false
		}

		let files = filesNeeded[provider]
		if ( ! files)
			return Promise.reject(new Error("unknown deploy provider: " + provider))
		for (let file of files)
			this._generateFile(file, infos)

		console.log("TODO: generation ok => heroku docker:release")

		return Promise.resolve()
	}
}

module.exports = Deploy