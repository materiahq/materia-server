import * as events from 'events'

import * as fs from 'fs'
import * as path from 'path'

import * as fse from 'fs-extra'

import { Logger } from './logger'

import { Config, ConfigType, IGitConfig, IWebConfig, IDatabaseConfig } from './config'
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
	package: string

	materia_path: string = __dirname
	mode: AppMode

	loaded: boolean = false

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
	//git: any

	status: boolean
	live: boolean = false

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
			//let Git = require('./git')
			//this.git = new Git.default(this)

			//this.deploy = new Deploy(this)

			let AddonsTools = require('./runtimes/tools/addons')
			this.addonsTools = new AddonsTools(this)
		}
	}

	private doMigrations() {
		if ( this.migration ) {
			return this.migration.check().then(() => {
				delete this.migration
			})
		}
		return Promise.resolve()
	}

	private loadMateriaConfig():Promise<IMateriaConfig> {
		return new Promise((resolve, reject) => {
			if ( ! fs.existsSync(this.path) ) {
				return reject(new MateriaError('The application directory has not been found. The folder has been moved or removed'))
			}
			if ( ! fs.existsSync(path.join(this.path, 'package.json')) ) {
				return reject(new MateriaError('package.json does not exists', {
					debug: `package.json does not exists, please use "npm init"`
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
				this.package = confJson.name
				if ( ! confJson.materia.name ) {
					confJson.materia.name = confJson.name
				}
				return resolve(confJson.materia)
			})
		})
	}


	loadMateria():Promise<void> {
		let p:Promise<any> = Promise.resolve()

		return this.doMigrations()
			.then(() => this.loadMateriaConfig())
			.then(materiaConf => {
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

	load():Promise<any> {
		let warning, elapsedTimeQueries, elapsedTimeEntities, elapsedTimeAPI
		let elapsedTimeGlobal = new Date().getTime()

		return this.loadMateria().then(() => {
			this.logger.log(`(Load) Application: ${this.name || this.package }`)
			this.logger.log(` └── Path: ${this.path}`)
			this.logger.log(` └── Mode: ${this.mode == AppMode.DEVELOPMENT ? 'Development' : 'Production' }`)

			this.database.load()
			this.server.load()
			return this.addons.loadAddons()
		})
		.then(() => this.entities.clear())
		.then(() => this.logger.log(' └── Files'))
		.then(() => this.addons.loadFiles())
		.then(() => this.entities.loadFiles())
		.then(() => {
			if ( ! this.database.disabled) {
				return this.database.start().then((e) => {
					warning = e
					this.logger.log(' └─┬ Entities')
					elapsedTimeEntities = new Date().getTime()
					return this.addons.loadEntities()
				})
				.then(() => this.entities.loadEntities())
				.then(() => this.entities.loadRelations())
				.then(() => this.logger.log(` │ └── Completed in ${(new Date().getTime()) - elapsedTimeEntities} ms`))
			}
			else {
				this.logger.log(' └── Entities: (Warning) Skipped. No database configured')
				return Promise.resolve()
			}
		})
		.then(() => this.entities.resetModels())
		.then(() => this.server.session.initialize())
		.then(() => this.logger.log(' └─┬ Queries'))
		.then(() => elapsedTimeQueries = new Date().getTime())
		.then(() => this.addons.loadQueries())
		.then(() => this.entities.loadQueries())
		.then(() => this.logger.log(` │ └── Completed in ${(new Date().getTime()) - elapsedTimeQueries} ms`))
		.then(() => this.api.resetControllers())
		.then(() => this.logger.log(` └─┬ API`))
		.then(() => elapsedTimeAPI = new Date().getTime())
		.then(() => this.addons.loadAPI())
		.then(() => this.api.load())
		.then(() => this.logger.log(` │ └── Completed in ${(new Date().getTime()) - elapsedTimeAPI} ms`))
		.then(() => this.history.load())
		.then(() => this.logger.log(` └── Successfully loaded in ${(new Date().getTime()) - elapsedTimeGlobal} ms\n`))
		.then(() => warning)
	}

	createDockerfile(options) {
		let dockerfile = path.join(this.path, 'Dockerfile')
		let dbProd = this.config.get<IDatabaseConfig>(AppMode.PRODUCTION, ConfigType.DATABASE)
		let webProd = this.config.get<IWebConfig>(AppMode.PRODUCTION, ConfigType.WEB)
		fs.writeFileSync(dockerfile, `FROM node:7.10-alpine
MAINTAINER ${options.author}

RUN mkdir -p /app

# invalidate cache
RUN uptime

COPY . /app

WORKDIR /app

RUN npm install

ENV MATERIA_MODE production

EXPOSE ${webProd.port}
CMD ["npm", "start"]`)

		let dbstr = '', dbport;
		if (dbProd.type == 'postgres') {
			dbport = 5432
			dbstr = `
    image: postgres:9.6.3-alpine
    environment:
      POSTGRES_USER: "${dbProd.username}"
      POSTGRES_PASSWORD: "${dbProd.password}"
      POSTGRES_DB: "${dbProd.database}"`
		}
		else if (dbProd.type == 'mysql') {
			dbport = 3306
			dbstr = `
    image: mysql
    environment:
      MYSQL_ROOT_PASSWORD: "${dbProd.password}"
      MYSQL_DATABASE: "${dbProd.database}"`
			if (dbProd.username != 'root') {
				dbstr += `
      MYSQL_USER: "${dbProd.username}"
      MYSQL_PASSWORD: "${dbProd.password}"`
			}
		}

		fs.writeFileSync(path.join(this.path, 'docker-compose.yaml'), `version: "3"
services:
  db: ${dbstr}
  web:
    build: .
    ports:
      - "${webProd.port}:${webProd.port}"
    links:
      - db
    depends_on:
      - db
    environment:
      MATERIA_MODE: "production"
      NO_HOST: "true"`)
	}

	createAppYaml(options) {
		let appyaml = path.join(this.path, 'app.yaml')
		fs.writeFileSync(appyaml, `runtime: nodejs
env: flex

skip_files:
 - ^node_modules$
 - ^.materia/live$
 - ^.git$

env_variables:
  MATERIA_MODE: 'production'
  NO_HOST: true

beta_settings:
 cloud_sql_instances: ${options.project}:${options.region}:${options.instance}

manual_scaling:
  instances: ${options.scale}`)
	}

	saveGCloudSettings(settings) {
		fs.writeFileSync(path.join(this.path, '.materia', 'gcloud.json'), JSON.stringify(settings, null, 2), 'utf8')
	}

	setPackageScript(name, script) {
		let pkg
		try {
			let content = fs.readFileSync(path.join(this.path, 'package.json')).toString()
			pkg = JSON.parse(content)
			pkg.scripts[name] = script
			fs.writeFileSync(path.join(this.path, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8')
		}
		catch (e) {
			if (e.code != 'ENOENT') {
				throw e
			}
		}
	}

	saveMateria(opts?: ISaveOptions) {
		if (opts && opts.beforeSave) {
			opts.beforeSave('package.json')
		}

		let pkg
		try {
			let content = fs.readFileSync(path.join(this.path, 'package.json')).toString()
			pkg = JSON.parse(content)
		}
		catch (e) {
			if (e.code != 'ENOENT') {
				throw e
			}
		}
		if (this.infos.addons && Object.keys(this.infos.addons).length == 0) {
			delete this.infos.addons
		}
		pkg.name = this.package

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
		} else if (key == 'package') {
			this.package = value
		} else {
			this.infos[key] = value
		}
	}

	/**
	Starts the materia app
	*/
	start() {
		let warning
		this.logger.log(`(Start) Application ${this.name}`)
		let p = this.database.started ? Promise.resolve() : this.database.start()
		return p.catch((e) => {
			e.errorType = 'database'
			throw e
		}).then((e) => {
			if (this.database.disabled) {
				this.logger.log(` └── Database: Disabled`)
			}
			else {
				this.logger.log(` └── Database: OK`)
			}
			warning = e
			return this.entities.start().catch((e) => {
				e.errorType = 'entities'
				throw e
			})
		}).then(() => {
			if ( ! this.database.disabled ) {
				this.logger.log(` └── Entities: OK`)
			}
			return this.addons.start().catch((e) => {
				e.errorType = 'addons'
				throw e
			})
		}).then(() => {
			this.logger.log(` └── Addons: OK`)
			if (this.mode == AppMode.PRODUCTION && ! this.live) {
				return this.synchronizer.diff().then((diffs) => {
					if (diffs && diffs.length == 0) {
						this.logger.log(' └── Synchronize: DB already up to date')
						return
					}
					this.logger.log(' └─┬ Synchronize: The database structure differs from entities.')
					return this.synchronizer.entitiesToDatabase(diffs, {}).then((actions) => {
						this.logger.log(` │ └── Database: Updated successfully. (Applied ${actions.length} actions)`)
					})
				}).catch((e) => {
					this.logger.log(` │ └── Database: Fail - An action could not be applied: ${e}`)
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
			this.logger.log('')
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
}