import * as events from 'events'
import chalk from 'chalk'
import * as fs from 'fs'
import * as path from 'path'

import * as fse from 'fs-extra'

import { Logger } from './logger'

import { IAppConfig, IDatabaseConfig, IServerConfig } from "@materia/interfaces";
import { Config, ConfigType } from './config'
import { Server } from './server'
import { Entities } from './entities'
import { Database } from './database'
import { Synchronizer } from './synchronizer'
import { SelfMigration } from './self-migration'
import { History } from './history'
import { Client } from './client'

import { Addons, IAddon } from './addons'
import { Api } from './api'

import { MateriaError } from './error'
import { MateriaApi } from '../api';
import { Watcher } from './watcher';

// let AddonsTools = require('./runtimes/tools/addons')

export * from "./addons/helpers";

export interface IAppOptions {
	mode?: string,
	runtimes?: string,
	nocolors?: boolean,
	level?: number,
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
export class App extends events.EventEmitter {
	id: string
	name: string
	package: string
	version?: string
	icon?: string
	zoom?: number
	// private packageJsonCache?: string

	materia_path: string = __dirname

	mode = AppMode.DEVELOPMENT
	loaded = false

	// infos: IMateriaConfig

	history: History
	entities: Entities
	addons: Addons
	database: Database
	api: Api
	server: Server
	// websocket: Websocket
	client: Client
	logger: Logger
	config: Config
	selfMigration: SelfMigration
	materiaApi: MateriaApi
	watcher: Watcher

	//git: any

	status: boolean
	live: boolean = false

	addonsTools: any
	synchronizer: Synchronizer

	invalid: boolean
	error: string

	rootPassword: string

	constructor(public path: string, public options?: IAppOptions) {
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
		this.client = new Client(this)
		this.synchronizer = new Synchronizer(this)
		this.config = new Config(this)
		this.materiaApi = new MateriaApi(this)
		this.watcher = new Watcher(this);

		this.status = false

		this.selfMigration = new SelfMigration(this)

		if (this.options.runtimes != "core") {
			//let Git = require('./git')
			//this.git = new Git.default(this)

			//this.deploy = new Deploy(this)

			let AddonsTools = require('./runtimes/tools/addons')
			this.addonsTools = new AddonsTools(this)
		}
	}

	private doSelfMigrations() {
		if ( this.selfMigration ) {
			return this.selfMigration.check().then(() => {
				delete this.selfMigration
			})
		}
		return Promise.resolve()
	}


	loadMateria():Promise<void> {
		return this.doSelfMigrations()
			.then(() => {
				this.config.reloadConfig();
				const appConfig = this.config.get<IAppConfig>(this.mode, ConfigType.APP);
				if (appConfig) {
					this.package = appConfig.package
					this.name = appConfig.name
					this.version = appConfig.version
					this.icon = appConfig.icon
					this.rootPassword = appConfig.rootPassword
				}
			})
	}

	load():Promise<any> {
		let warning, elapsedTimeQueries, elapsedTimeEntities, elapsedTimeAPI
		let elapsedTimeGlobal = new Date().getTime()

		return this.loadMateria()
		.then(() => {
			this.logger.log(`${chalk.bold('(Load)')} Application: ${chalk.yellow.bold(this.name || this.package)}`)
			this.logger.log(` └── Path: ${chalk.bold(this.path)}`)
			this.logger.log(` └── Mode: ${chalk.bold(this.mode == AppMode.DEVELOPMENT ? 'Development' : 'Production' )}`)

			this.database.load()
			return this.client.load()
		})
		.then(() => this.server.load())
		.then(() => this.database.start())
		.then(() => this.entities.clear())
		.then(() => this.server.session.initialize())
		.then(() => this.materiaApi.initialize())
		.then(() => this.logger.log(` └── Sessions: ${chalk.green.bold('OK')}`))
		.then(() => this.addons.loadAddons())
		.then(() => this.addons.loadFiles())
		.then(() => this.entities.loadFiles())
		.then(() => this.logger.log(' └─┬ Entities'))
		.then(() => elapsedTimeEntities = new Date().getTime())
		.then(() => this.addons.loadEntities())
		.then(() => this.entities.loadEntities())
		.then(() => this.entities.loadRelations())
		.then(() => this.logger.log(` │ └── ${chalk.green.bold('OK') + ' - Completed in ' + chalk.bold(((new Date().getTime()) - elapsedTimeEntities).toString() + 'ms')}`))
		.then(() => this.entities.resetModels())
		.then(() => this.logger.log(' └─┬ Queries'))
		.then(() => elapsedTimeQueries = new Date().getTime())
		.then(() => this.addons.loadQueries())
		.then(() => this.entities.loadQueries())
		.then(() => this.logger.log(` │ └── ${chalk.green.bold('OK') + ' - Completed in ' + chalk.bold(((new Date().getTime()) - elapsedTimeQueries).toString() + 'ms')}`))
		.then(() => this.api.resetControllers())
		.then(() => this.logger.log(` └─┬ API`))
		.then(() => elapsedTimeAPI = new Date().getTime())
		.then(() => this.addons.loadAPI())
		.then(() => this.api.load())
		.then(() => this.logger.log(` │ └── ${chalk.green.bold('OK') + ' - Completed in ' + chalk.bold(((new Date().getTime()) - elapsedTimeAPI).toString() + 'ms')}`))
		.then(() => this.watcher.load())
		.then(() => this.history.load())
		.then(() => this.logger.log(` └── ${chalk.green.bold("Successfully loaded in " + ((new Date().getTime()) - elapsedTimeGlobal).toString() + 'ms')}\n`))
		.then(() => warning)
	}

	createDockerfile(options) {
		let dockerfile = path.join(this.path, 'Dockerfile')
		let dbProd = this.config.get<IDatabaseConfig>(AppMode.PRODUCTION, ConfigType.DATABASE)
		let webProd = this.config.get<IServerConfig>(AppMode.PRODUCTION, ConfigType.SERVER)
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

		let dbstr = '';
		if (Database.isSQL(dbProd) && dbProd.type == 'postgres') {
			// dbport = 5432
			dbstr = `
    image: postgres:9.6.3-alpine
    environment:
      POSTGRES_USER: "${dbProd.username}"
      POSTGRES_PASSWORD: "${dbProd.password}"
      POSTGRES_DB: "${dbProd.database}"`
		}
		else if (Database.isSQL(dbProd) && dbProd.type == 'mysql') {
			// dbport = 3306
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
		fs.writeFileSync(path.join(this.path, '.materia', 'gcloud.json'), JSON.stringify(settings, null, 2))
	}

	setPackageScript(name, script) {
		let pkg
		try {
			let content = fs.readFileSync(path.join(this.path, 'package.json')).toString()
			pkg = JSON.parse(content)
			pkg.scripts[name] = script
			fs.writeFileSync(path.join(this.path, 'package.json'), JSON.stringify(pkg, null, 2))
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
		pkg.name = this.package

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
	// updateInfo(key, value) {
	// 	if (key == "name") {
	// 		this.name = this.infos.name = value
	// 	} else if (key == 'package') {
	// 		this.package = value
	// 	} else {
	// 		this.infos[key] = value
	// 	}
	// }

	/**
	Starts the materia app
	*/
	start() {
		let warning
		this.logger.log(`${chalk.bold('(Start)')} Application ${chalk.yellow.bold(this.name)}`)
		let p = this.database.started ? Promise.resolve() : this.database.start()
		return p.catch((e) => {
			e.errorType = 'database'
			throw e
		}).then((e) => {
			if (this.database.disabled) {
				this.logger.log(` └── Database: ${chalk.red.bold('Disabled')}`)
			}
			else {
				this.logger.log(` └── Database: ${chalk.green.bold('OK')}`)
			}
			warning = e
			return this.entities.start().catch((e) => {
				e.errorType = 'entities'
				throw e
			})
		}).then(() => {
			if ( ! this.database.disabled ) {
				this.logger.log(` └── Entities: ${chalk.green.bold('OK')}`)
			}
			return this.addons.start().catch((e) => {
				e.errorType = 'addons'
				throw e
			})
		}).then(() => {
			this.logger.log(` └── Addons: ${chalk.bold.green('OK')}`)
			if (this.mode == AppMode.PRODUCTION && ! this.live) {
				return this.synchronizer.diff().then((diffs) => {
					if (diffs && diffs.length == 0) {
						this.logger.log(` └── Synchronize: ${chalk.bold('DB already up to date')}`)
						return
					}
					this.logger.log(` └─┬ Synchronize: ${chalk.yellow.bold('The database structure differs from entities.')}`)
					return this.synchronizer.entitiesToDatabase(diffs, {}).then((actions) => {
						this.logger.log(` │ └── Database: ${chalk.green.bold('Updated successfully')}. (Applied ${chalk.bold(actions.length.toString())} actions)`)
					})
				}).catch((e) => {
					this.logger.log(` │ └── Database: ${chalk.red.bold('Fail - An action could not be applied: ' + e)}`)
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
	stop():Promise<void> {
		return this.server.stop()
			.then(() => this.database.stop())
			.then(() => this.watcher.dispose())
			.then(() => { this.status = false; })
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
		const splittedName = this.path.split(path.sep);
		const length = splittedName.length;
		const appFolder = splittedName[length - 1];
		name = name || appFolder
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

	initializeStaticDirectory() {
		let p = Promise.resolve();
		if ( ! fs.existsSync(path.join(this.path, 'client'))) {
			fs.mkdirSync(path.join(this.path, 'client'));
			if ( ! fs.existsSync(path.join(this.path, 'client', 'index.html'))) {
				fs.writeFileSync(path.join(this.path, 'client', 'index.html'), `<!DOCTYPE html>
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
			this.server.dynamicStatic.setPath(path.join(this.path , 'client'));
		} else {
			p = Promise.reject(new Error('Client folder already exists'));
		}
		return p;
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
		return fs.readFileSync(fullpath, 'utf-8')
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
		let pkg = require('../package.json')
		return pkg.version
	}
}