'use strict';

var events = require('events')
var fs = require('fs')
var path = require('path')

var logger = require('./logger')

var Server = require('./server')
var Entities = require('./entities')
var Database = require('./database')
var Addons = require('./addons')
var Api = require('./api')
var History = require('./history')

module.exports = class App extends events.EventEmitter {
	constructor(path, options) {
		super()
		process.env.TZ = 'UTC'

		this.path = path
		this.options = options || {}
		this.materia_path = __dirname

		this.mode = this.options.mode || 'dev'
		if (this.mode == 'development' || this.mode == 'developement') {
			this.mode = 'dev'
		}
		else if (this.mode == 'production') {
			this.mode = 'prod'
		}
		else if (this.mode != 'dev' && this.mode != 'prod') {
			throw new Error("App constructor - Unknown mode")
		}

		logger(this)

		this.loadMateria()

		this.history = new History(this)
		this.addons = new Addons(this)
		this.entities = new Entities(this)
		this.database = new Database(this)
		this.api = new Api(this)
		this.server = new Server(this)

		if (options["runtimes"] != "core") {
			let Deploy = require('./runtimes/tools/deploy')
			this.deploy = new Deploy(this)
		}
	}

	load() {
		return new Promise((accept, reject) => {
			this.entities.load().then(() => {
				this.database.load()
				this.server.load()
				this.api.load()
				return this.history.load()
			}).then(() => {
				return this.addons.load()
			}).then(() => {
				accept()
			}).catch((err) => {
				reject(err)
			})
		})
	}

	loadMateria() {
		let materiaStr
		let materiaConf

		try {
			materiaStr = fs.readFileSync(path.join(this.path, 'materia.json')).toString()
		} catch(e) {
			e.message = 'Could not read file materia.json in app dir'
			throw e
		}

		try {
			materiaConf = JSON.parse(materiaStr)
		} catch(e) {
			e.message = 'Could not parse materia.json in app dir: ' + e.message
			throw e
		}

		if ( ! materiaConf.name)
			throw new Error('Missing "name" field in materia.json')

		if ( ! materiaConf.description)
			throw new Error('Missing "description" field in materia.json')

		if ( ! materiaConf.author)
			throw new Error('Missing "author" field in materia.json')

		this.infos = materiaConf
		this.name = this.infos.name
	}

	saveMateria() {
		fs.writeFileSync(path.join(this.path, 'materia.json'), JSON.stringify(this.infos, null, 2))
	}

	start() {
		return this.database.start().then(() => {
			return this.addons.start()
		}).then(() => {
			this.entities.sync()
			return this.server.start()
		})
	}

	stop() {
		return this.server.stop()
	}

	getFiles(name, p) {
		name = name || this.name
		p = p || this.path
		let results = []
		let files = fs.readdirSync(p)
		files.forEach((file) => {
			if (file != '.DS_Store') {
				let stats = fs.lstatSync(path.join(p, file))
				if (stats.isDirectory()) {
					results.push(this.getFiles(file, path.join(p, file)))
				}
				else {
					results.push({
						filename: file,
						path: p,
						fullpath: path.join(p, file)
					})
				}
			}
		})

		return {
			filename: name,
			path: p,
			fullpath: p,
			children: results
		}
	}

	readFile(fullpath) {
		return fs.readFileSync(fullpath, 'utf8')
	}

	saveFile(fullpath, content) {
		return fs.writeFileSync(fullpath, content);
	}
}
