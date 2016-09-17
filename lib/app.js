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

/**
 * @class App
 * @classdesc
 * The main objects are available from this class.
 * @property {Server} server - Access to the server's options
 * @property {Api} api - Access to the server's endpoints
 * @property {History} history - Access to the history and past actions
 * @property {Database} database - Access to the database methods
 * @property {Addons} addons - Access to the addons methods
 * @property {Entities} entities - Access to the app's entities
 */
class App extends events.EventEmitter {
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

		this.history = new History(this)
		this.addons = new Addons(this)
		this.entities = new Entities(this)
		this.database = new Database(this)
		this.api = new Api(this)
		this.server = new Server(this)

		this.loadMateria()

		if (this.options["runtimes"] != "core") {
			let Deploy = require('./runtimes/tools/deploy')
			this.deploy = new Deploy(this)

			let AddonsTools = require('./runtimes/tools/addons')
			this.addonsTools = new AddonsTools(this)

			let Versionning = require('./runtimes/tools/versionning')
			this.versionning = new Versionning(this)
		}
	}

	load() {
		let beforeLoad = Promise.resolve()
		try {
			this.addons.checkInstalled()
		} catch(e) {
			if (this.addonsTools) {
				console.log("Missing addons, trying to install...")
				beforeLoad = this.addonsTools.install_all().then(() => {
					console.log("Addons installed")
					return Promise.resolve()
				})
			} else {
				return Promise.reject(e)
			}
		}

		return beforeLoad.then(() => {
			if (this.database.load()) {
				return this.entities.load()
			}
			else {
				this.log('No database configuration for this application - Continue without Entities')
				return Promise.resolve()
			}
		}).then(() => {
			this.server.load()
			this.api.load()
			return this.history.load()
		}).then(() => {
			return this.addons.load()
		})
	}

	loadMateria() {
		let materiaStr
		let materiaConf, _materiaConf

		try {
			materiaStr = fs.readFileSync(path.join(this.path, 'materia.json')).toString()
		} catch(e) {
			e.message = 'Could not read `materia.json` in the application directory'
			throw e
		}

		try {
			_materiaConf = JSON.parse(materiaStr)
		} catch(e) {
			e.message = 'Could not parse materia.json in app dir: ' + e.message
			throw e
		}

		materiaConf = {}
		for (let k in _materiaConf) {
			materiaConf[k] = _materiaConf[k]
		}

		if ( ! materiaConf.name) {
			throw new Error('Missing "name" field in materia.json')
		}

		this.infos = materiaConf
		this.infos.addons = this.infos.addons || {}
		this._infos = _materiaConf
		this.name = this.infos.name
	}

	saveMateria(opts) {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		if (this.infos.addons && Object.keys(this.infos.addons).length) {
			this._infos.addons = this.infos.addons
		}
		else if (this._infos.addons) {
			delete this._infos.addons
		}
		fs.writeFileSync(path.join(this.path, 'materia.json'), JSON.stringify(this._infos, null, '\t'))
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	/**
	Set the a value in materia app configuration
	@param {string} - The configuration key
	@param {value} - The value to set
	*/
	updateInfo(key, value) {
		if (key == "name") {
			this.name = this.infos.name = this._infos.name = value
		} else {
			this.infos[key] = this._infos[key] = value
		}
	}

	/**
	Starts the materia app
	*/
	start() {
		return this.database.start().then(() => {
			return this.entities.start()
		}).then(() => {
			return this.addons.start()
		}).then(() => {
			return this.server.start()
		})
	}

	/**
	Stops the materia app
	*/
	stop() {
		return this.server.stop()
	}

	getFiles(depth, name, p) {
		name = name || this.name
		p = p || this.path
		let results = []

		if (depth) {
			let files = fs.readdirSync(p)
			files.forEach((file) => {
				if (file != '.DS_Store' && file != '.git' && file != 'history.json' && file != 'history') {
					let stats = fs.lstatSync(path.join(p, file))
					if (stats.isDirectory()) {
						results.push(this.getFiles(depth - 1, file, path.join(p, file)))
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
		}

		return {
			filename: name,
			path: p,
			fullpath: p,
			children: results,
			incomplete: ! depth
		}
	}

	initializeStaticDirectory(opts) {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		if ( ! fs.existsSync(path.join(this.path, 'web'))) {
			fs.mkdirSync(path.join(this.path, 'web'))
		}
		if ( ! fs.existsSync(path.join(this.path, 'web', 'index.html'))) {
			fs.appendFileSync(path.join(this.path, 'web', 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Document</title>
</head>
<body>
	<h1>Hello world!</h1>
</body>
</html>`)
		}
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	_getWatchableFiles(files) {
		let res = []
		for (let file of files) {
			if ( ! Array.isArray(file.children)) {
				let filenameSplit = file.filename.split('.');
				if (['json', 'js', 'coffee', 'sql'].indexOf(filenameSplit[filenameSplit.length - 1]) != -1) {
					res.push(file)
				}
			}
			else {
				let t = this._getWatchableFiles(file.children);
				t.forEach((a) => { res.push(a) })
			}
		}
		return res
	}

	getWatchableFiles() {
		let files = this.getFiles(5)
		return this._getWatchableFiles(files.children)
	}

	readFile(fullpath) {
		return fs.readFileSync(fullpath, 'utf8')
	}

	saveFile(fullpath, content) {
		return fs.writeFileSync(fullpath, content);
	}
}

module.exports = App