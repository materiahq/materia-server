import * as events from 'events'

import * as fs from 'fs'
import * as path from 'path'

import * as fse from 'fs-extra'

import { Logger } from './logger'

import { Config, ConfigType, IGitConfig } from './config'
import { Server } from './server'
import { Entities } from './entities'
import { Database } from './database'
import { Synchronizer } from './synchronizer'
import { Migration } from './migration'
import { History } from './history'

import Addons, { IAddon } from './addons'
import Api from './api'

import MateriaError from './error'

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
	fromAddon?: IAddon
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

	loaded: false

	infos: IMateriaConfig

	history: History
	entities: Entities
	addons: Addons
	database: Database
	api: Api
	server: Server
	logger: Logger
	config: Config
	migration: Migration
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
			throw new MateriaError("Unknown mode", {
				debug: 'Option --mode can be development (development/dev/debug) or production (production/prod). e.g. materia start --mode=prod or materia start --mode=dev'
			})
		}

		this.logger = new Logger(this)

		this.history = new History(this)
		this.addons = new Addons(this)
		this.entities = new Entities(this)
		this.database = new Database(this)
		this.api = new Api(this)
		this.server = new Server(this)
		this.synchronizer = new Synchronizer(this)
		this.config = new Config(this)

		this.status = false

		this.migration = new Migration(this)

		if (this.options.runtimes != "core") {
			let Git = require('./git')
			this.git = new Git.default(this)

			this.deploy = new Deploy(this)

			let AddonsTools = require('./runtimes/tools/addons')
			this.addonsTools = new AddonsTools(this)
		}
	}

	loadMateria():Promise<void> {
		let p:Promise<any> = Promise.resolve()
		if ( this.migration ) {
			p = p.then(() => {
				return this.migration.check()
			}).then(() => {
				delete this.migration
			})
		}
		return p.then(() => this._loadMateriaConfig()).then((materiaConf) => {
			if ( ! materiaConf.name) {
				return Promise.reject(new MateriaError('Missing "name" field in package.json', {
					debug: `Please provide a valid package description in package.json or use "npm init"`
				}))
			}

			this.infos = materiaConf
			this.infos.addons = this.infos.addons || {}
			this.name = this.infos.name
			return Promise.resolve()
		})
	}

	check():Promise<any> {
		if (this.git) {
			return this.git.load().then(() => {
				return this.git.status().then(status => {
					for (let file of status.files) {
						if (file.working_dir == 'U') {
							throw new MateriaError('Git repo contains unresolved conflicts')
						}
					}
				}).catch(e => {
					if (e && e.message && e.message.match(/This operation must be run in a work tree/)) {
						return Promise.resolve()
					}
					throw e
				})
			})
		}
		return Promise.resolve()
	}

	load():Promise<any> {
		let p = Promise.resolve()
		let warning
		if ( ! this.loaded) {
			p = this.loadMateria()
		}
		return p.then(() => {
			this.database.load()
			this.server.load()
			return this.addons.loadAddons()
		})
		.then(() => this.entities.clear())
		.then(() => this.addons.loadFiles())
		.then(() => this.entities.loadFiles())
		.then(() => {
			if ( ! this.database.disabled) {
				return this.database.start().then((e) => {
					warning = e
					return this.addons.loadEntities()
				}).then(() => this.entities.loadEntities()
				).then(() => this.entities.loadRelations())
			}
			else {
				this.logger.log('No database configuration for this application - Continue without Entities')
				return Promise.resolve()
			}
		})
		.then(() => this.entities.resetModels())
		.then(() => this.addons.loadQueries())
		.then(() => this.entities.loadQueries())
		.then(() => this.api.resetControllers())
		.then(() => this.addons.loadAPI())
		.then(() => this.api.load())
		.then(() => this.history.load())
		.then(() => this.git && this.git.load())
		.then(() => warning)
	}

	private _loadMateriaConfig():Promise<IMateriaConfig> {
		return new Promise((resolve, reject) => {
			fs.exists(this.path, exists => {
				if ( ! exists ) {
					return reject(new MateriaError('The application directory has not been found. The folder has been moved or removed'))
				}
				fs.exists(path.join(this.path, 'package.json'), exists => {
					if ( ! exists ) {
						return reject(new MateriaError('package.json does not exists', {
							debug: `Please provide a valid package description in package.json or use "npm init"`
						}))
					}
					fs.readFile(path.join(this.path, 'package.json'), 'utf8', (err, conf) => {
						if (err) {
							return reject(new MateriaError('Could not load package.json'))
						}
						let confJson
						try {
							confJson = JSON.parse(conf)
						}
						catch (e) {
							return reject(new MateriaError('Could not parse package.json. The JSON seems invalid'))
						}
						confJson.materia = confJson.materia || {}
						confJson.materia.name = confJson.name
						return resolve(confJson.materia)
					})
				})
			})
		})
	}


	saveMateria(opts?: ISaveOptions) {
		if (opts && opts.beforeSave) {
			opts.beforeSave('package.json')
		}

		let pkg
		try {
			let content = fs.readFileSync(path.join(this.path, 'package.json')).toString()
			let pkg = JSON.parse(content)
		}
		catch (e) {
			if (e.code != 'ENOENT') {
				throw e
			}
		}
		if (this.infos.addons && Object.keys(this.infos.addons).length == 0) {
			delete this.infos.addons
		}
		pkg.materia = this.infos
		fs.writeFileSync(path.join(this.path, 'package.json'), JSON.stringify(pkg, null, 2))
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
		let warning
		let p = this.database.started ? Promise.resolve() : this.database.start()
		return p.catch((e) => {
			e.errorType = 'database'
			throw e
		}).then((e) => {
			warning = e
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
			return warning
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

	saveFile(fullpath:string, content:string, opts?): Promise<any> {
		let p = Promise.resolve()
		if (opts && opts.beforeSave) {
			opts.beforeSave(path.resolve(this.path, fullpath))
		}
		if (opts && opts.mkdir) {
			try {
				fse.mkdirpSync(path.dirname(fullpath))
			} catch (e) {
				p = Promise.reject(e)
			}
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

	getMateriaVersion() {
		let pkg = require('../../package')
		return pkg.version
	}

	installLive():Promise<any> {
		let gitConfig = this.config.get(AppMode.PRODUCTION, ConfigType.GIT) as IGitConfig
		if ( ! gitConfig || ! gitConfig.remote || ! gitConfig.branch ) {
			return Promise.reject(new MateriaError('Missing git configuration for production mode.'))
		}
		return this.git.copyCheckout({
			path: this.path,
			to: path.resolve(this.path, '.materia', 'live'),
			remote: gitConfig.remote,
			branch: gitConfig.branch
		})
	}
}