import * as events from 'events'

import * as fs from 'fs'
import * as path from 'path'

import * as mkdirp from 'mkdirp'

import { Logger } from './logger'

import { Server } from './server'
import { Entities } from './entities'
import { Database } from './database'

import { Synchronizer } from './synchronizer'

import Addons from './addons'
import Api from './api'

import { History } from './history'

//TODO: convert to ts
let Deploy = require('./runtimes/tools/deploy')
let AddonsTools = require('./runtimes/tools/addons')

export interface IAppOptions {
	mode?: string,
	runtimes?: string,
	nocolors?: boolean,
	silent?: boolean,
	logSql?: boolean,
	logRequests?: boolean,
	prod?: boolean,
	port?: number,

	"database-host"?: string
	"database-port"?: number
	"database-db"?: string
	"database-username"?: string
	"database-password"?: string
	storage?: string //sqlite.database
}

export interface ISaveOptions {
	beforeSave?: (path?: string) => Object,
	afterSave?: (lock?: Object) => void
}

export interface IApplyOptions extends ISaveOptions {
	apply?: boolean
	history?: boolean
	save?: boolean
	db?: boolean
	wait_relations?: boolean
	fromAddon?: string
}

export interface IMateriaConfig {
	name: string,
	icon?: {
		color?: string
	},
	addons?: any
}

export enum AppMode {
	DEVELOPMENT = <any>'dev',
	PRODUCTION = <any>'prod'
}
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
export default class App extends events.EventEmitter {
	name: string

	materia_path: string = __dirname
	mode: AppMode

	infos: IMateriaConfig

	history: History
	entities: Entities
	addons: any
	database: Database
	api: any
	server: Server
	logger: Logger
	git: any

	status: boolean
	live: boolean = false

	deploy: any
	addonsTools: any
	synchronizer: Synchronizer

	constructor(public path: string, public options: IAppOptions) {
		super()
		process.env.TZ = 'UTC'

		if ( ! this.options ) {
			this.options = {}
		}

		if ( this.options.prod ) {
			this.options.mode = 'prod'
		}

		if ( ! this.options.mode ) {
			this.mode = AppMode.DEVELOPMENT
		}
		else if (['development', 'dev', 'debug'].indexOf(this.options.mode) != -1) {
			this.mode = AppMode.DEVELOPMENT
		}
		else if (this.options.mode == 'production' || this.options.mode == 'prod') {
			this.mode = AppMode.PRODUCTION
			if ( ! this.options.runtimes) {
				this.options.runtimes = 'core'
			}
		}
		else {
			throw new Error("App constructor - Unknown mode")
		}

		this.logger = new Logger(this)

		this.history = new History(this)
		this.addons = new Addons(this)
		this.entities = new Entities(this)
		this.database = new Database(this)
		this.api = new Api(this)
		this.server = new Server(this)
		this.synchronizer = new Synchronizer(this)

		this.status = false

		this.loadMateria()

		if (this.options.runtimes != "core") {
			this.deploy = new Deploy(this)

			let AddonsTools = require('./runtimes/tools/addons')
			this.addonsTools = new AddonsTools(this)

			let Git = require('./git')
			this.git = new Git.default(this)
		}
	}

	load():Promise<any> {
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
				return this.database.start().then(() => {
					return this.entities.load()
				})
			}
			else {
				this.logger.log('No database configuration for this application - Continue without Entities')
				return Promise.resolve()
			}
		}).then(() => {
			this.server.load()
			this.api.load()
		}).then(() => {
			return this.history.load()
		}).then(() => {
			return this.addons.load()
		}).then(() => {
			if (this.git) {
				return this.git.load()
			}
		})
	}

	loadMateria():void {
		let materiaStr: string
		let materiaConf: IMateriaConfig

		try {
			materiaStr = fs.readFileSync(path.join(this.path, 'materia.json')).toString()
			materiaConf = JSON.parse(materiaStr)
		} catch(e) {
			e.message = 'Could not read/parse `materia.json` in the application directory'
			throw e
		}

		if ( ! materiaConf.name) {
			throw new Error('Missing "name" field in materia.json')
		}

		this.infos = materiaConf
		this.infos.addons = this.infos.addons || {}
		this.name = this.infos.name
	}

	saveMateria(opts?: ISaveOptions) {
		if (opts && opts.beforeSave) {
			opts.beforeSave('materia.json')
		}
		if (this.infos.addons && Object.keys(this.infos.addons).length == 0) {
			delete this.infos.addons
		}
		fs.writeFileSync(path.join(this.path, 'materia.json'), JSON.stringify(this.infos, null, '\t'))
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
			this.name = this.infos.name = value
		} else {
			this.infos[key] = value
		}
	}

	/**
	Starts the materia app
	*/
	start() {
		return this.database.start().catch((e) => {
			e.errorType = 'database'
			throw e
		}).then(() => {
			return this.entities.start().catch((e) => {
				e.errorType = 'entities'
				throw e
			})
		}).then(() => {
			return this.addons.start().catch((e) => {
				e.errorType = 'addons'
				throw e
			})
		}).then(() => {
			if (this.mode == AppMode.PRODUCTION && ! this.live) {
				return this.synchronizer.diff().then((diffs) => {
					if (diffs && diffs.length == 0) {
						return
					}
					this.logger.log('INFO: The database structure differs from entities. Syncing...')
					return this.synchronizer.entitiesToDatabase(diffs, {}).then((actions) => {
						this.logger.log(`INFO: Successfully updated the database. (Applied ${actions.length} actions)`)
					})
				}).catch((e) => {
					e.errorType = 'sync'
					throw e
				})
			}
		}).then(() => {
			return this.server.start().catch((e) => {
				e.errorType = 'server'
				throw e
			})
		}).then(() => {
			this.status = true
		})
	}

	/**
	Stops the materia app
	*/
	stop() {
		return this.server.stop().then(() => {
			return this.database.stop()
		}).then(() => {
			this.status = false
		})
	}

	_getFile(file, p) {
		return new Promise((resolve, reject) => {
			fs.lstat(path.join(p, file), (err, stats) => {
				if ( err ) {
					return reject( err )
				}
				if (stats.isDirectory()) {
					this.getAllFiles(file, path.join(p, file)).then((res) => {
						resolve(res)
					}).catch((e) => {
						reject(e)
					})
				}
				else {
					resolve({
						filename: file,
						path: p,
						fullpath: path.join(p, file)
					})
				}
			})
		})
	}

	getAllFiles(name, p) {
		name = name || this.name
		p = p || this.path
		//let results = []

		return new Promise((resolve, reject) => {
			fs.readdir(p, (err, files) => {
				let promises = []
				if ( err ) {
					return reject( err )
				}
				files.forEach((file) => {
					if (file != '.DS_Store' &&
					file != '.git' &&
					file != 'history.json' &&
					file != 'history' &&
					file != 'node_modules' &&
					file != 'bower_components' &&
					file != '_site') {
						promises.push(this._getFile(file, p))
					}
				})
				Promise.all(promises).then((results) => {
					resolve({
						filename: name,
						path: p,
						fullpath: p,
						children: results
					})
				}, (reason) => {
					reject(reason)
				})
			})
		})
	}

	getFiles(depth: number, name?:string, p?:string) {
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
			opts.beforeSave('web')
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

	saveFile(fullpath, content, opts) {
		let p = Promise.resolve()
		if (opts && opts.beforeSave) {
			opts.beforeSave(path.relative(this.path, fullpath))
		}
		if (opts && opts.mkdir) {
			p = new Promise((accept, reject) => {
				mkdirp(path.dirname(fullpath), (err) => {
					if (err) {
						return reject(err)
					}
					accept()
				})
			})
		}

		return p.then(() => {
			fs.writeFileSync(fullpath, content)
			if (opts && opts.afterSave) {
				opts.afterSave()
			}
		}).catch((e) => {
			if (opts && opts.afterSave) {
				opts.afterSave()
			}
			throw e
		})
	}
}