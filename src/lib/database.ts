import * as fs from 'fs'
import * as path from 'path'

import * as Sequelize from 'sequelize'

let domain = require('domain')

import App, { AppMode, ISaveOptions } from './app'

import { ConfigType, IDatabaseConfig, IConfigOptions } from './config'

import { DatabaseInterface } from './database/interface'
import MateriaError from './error'

export enum Dialect {
	POSTGRES,
	SQLITE,
	MYSQL
}

export interface ISequelizeConfig {
	dialect: string,
	host: string,
	port: number,
	logging: any,
	storage?: string
	dialectOptions?: any
}

export interface IBackup {
	started: boolean
	done?: boolean
	progress?: number
	current?: number
	total?: number
	callback: any
}

/**
 * @class Database
 * @classdesc
 * Represent the connection to database
 */
export class Database {
	interface: DatabaseInterface

	disabled: boolean
	locked: boolean = false

	host: string
	port: number
	username: string
	password: string
	database: string
	storage: string
	type: string
	started: boolean

	opts: ISequelizeConfig

	sequelize: Sequelize.Sequelize

	backupInfo: IBackup

	constructor(private app: App) {
		this.interface = new DatabaseInterface(this)
		this.backupInfo = {
			started: false,
			callback: () => {}
		}
	}

	/**
	Load the database configuration
	@param {object} - *optional* The settings of the database
	@returns {object}
	*/
	load(settings?: IDatabaseConfig):boolean {
		this.disabled = false
		if ( ! settings && this.app.path) {
			this.app.config.reloadConfig()
			if (this.app.live) {
				settings = this.app.config.get<IDatabaseConfig>(this.app.mode, ConfigType.DATABASE, {live: true})
			}
			settings = settings || this.app.config.get<IDatabaseConfig>(this.app.mode, ConfigType.DATABASE)
		}

		if ( ! settings) {
			this.disabled = true
			this.app.logger.log(` └── Database: No database configured!`)
			return false
		}

		this.host = this.app.options['database-host'] || settings.host || 'localhost'
		this.port = Number(this.app.options['database-port'] || settings.port)
		this.username = this.app.options['database-username'] || settings.username
		this.password = this.app.options['database-password'] || settings.password
		this.database = this.app.options['database-db'] || settings.database
		this.storage = this.app.options['storage'] || settings.storage
		this.type = settings.type
		this.started = false

		let logging: any
		if (this.app.options.logSql == true)
			logging = (...args) => { this.app.logger.log.apply(this.app.logger, args) }
		else if (this.app.options.logSql !== undefined)
			logging = this.app.options.logSql
		else
			logging = false

		this.opts = {
 			dialect: this.type,
			host: this.host,
			port: this.port,
			logging: logging
		}

		if (this.type == 'sqlite') {
			this.opts.storage = path.resolve(this.app.path, this.storage || 'database.sqlite')
		}

		if (this.app.mode == AppMode.PRODUCTION && process.env.GCLOUD_PROJECT && this.type == 'mysql') {
			try {
				let gcloudJsonPath = path.join(this.app.path, '.materia', 'gcloud.json')
				if (fs.existsSync(gcloudJsonPath)) {
					let gcloudSettings = JSON.parse(fs.readFileSync(gcloudJsonPath, 'utf8'))
					this.opts.dialectOptions = { socketPath: `/cloudsql/${gcloudSettings.project}:${gcloudSettings.region}:${gcloudSettings.instance}` }
					delete this.opts.host
					delete this.opts.port
				}
				else {
					throw 'gcloud.json not found'
				}
			}
			catch (e) {
				this.app.logger.log(` └── Warning: Impossible to load GCloud database settings - ${e}`)
			}
		}

		this.app.logger.log(` └─┬ Database: OK`)
		this.app.logger.log(` │ └── Dialect: ${this.type}`)
		this.app.logger.log(` │ └── Options: ${JSON.stringify(this.opts)}`)

		return true
	}

	_confToJson(conf:IDatabaseConfig):IDatabaseConfig {
		if ( ! conf ) {
			return null
		}
		if (conf.type != 'sqlite') {
			return {
				type: conf.type,
				host: conf.host,
				port: conf.port,
				database: conf.database,
				username: conf.username,
				password: conf.password
			} as IDatabaseConfig
		}
		else {
			let res: IDatabaseConfig = {
				type: conf.type
			}
			if (conf.storage && conf.storage != "database.sqlite") {
				res.storage = conf.storage
			}
			return res
		}
	}

	/**
	Try to connect with a custom configuration
	@param {object} - The configuration object
	@returns {Promise}
	*/
	static try(settings: IDatabaseConfig, app?: App) {

		//TODO: check settings.storage to be a real path
		if (settings.type == 'sqlite' && settings.storage) {
			return Promise.resolve()
		}

		let opts: ISequelizeConfig = {
			dialect: settings.type,
			host: settings.host,
			port: settings.port,
			logging: false
		}

		if (settings.type == 'sqlite' && app) {
			opts.storage = path.resolve(app.path, settings.storage || 'database.sqlite')
		}
		let tmp
		return new Promise((accept, reject) => {
			let d = domain.create()
			try {
				tmp = new Sequelize(settings.database, settings.username, settings.password, opts)
			} catch (e) {
				return reject(e)
			}
			d.add(tmp.query)
			d.on('error', (e) => {
				d.remove(tmp.query)
				return reject(e)
			})
			d.run(() => {
				return tmp.authenticate().then(() => {
					tmp.close()
					accept()
				}).catch((e) => { reject(e) })
			})
		})
	}

	try(settings) {
		return Database.try(settings, this.app)
	}

	/**
	Connect to the database
	@returns {Promise}
	*/
	start():Promise<any> {
		if (this.sequelize) {
			this.stop()
		}

		if ( this.disabled ) {
			return Promise.resolve()
		}
		if ( ! this.interface.hasDialect(this.type)) {
			return Promise.reject(new MateriaError('The database\'s dialect is not supported'))
		}
		this.app.emit('db:start')
		try {
			this.sequelize = new Sequelize(this.database, this.username, this.password, this.opts)
		}
		catch(e) {
			return Promise.reject(e)
		}
		this.interface.setDialect(this.type)
		return this.interface.authenticate().then(() => {
			this.app.logger.log(` └── Database: Authenticated`)

			this.started = true
		}).catch((e) => {
			this.app.logger.error(` └── Database: Connection failed`)
			this.app.logger.error('    (Warning) Impossible to connect the database:', e && e.message)
			this.app.logger.error('    The database has been disabled')
			this.disabled = true
			return Promise.resolve(e)
		})
	}

	/**
	Stop the database connection
	*/
	stop() {
		this.started = false
		if (this.sequelize) {
			this.sequelize.close()
			this.sequelize = null
		}
	}


	/**
	Synchronize the database with the state of the application
	@returns {Promise}
	*/
	sync():Promise<any> {
		return this.app.entities.sync().then(() => {
			return this.sequelize.sync()
		})
	}

	//Deprecated: use sync() instead as sequelize({force: true}) will remove all data
	forceSync() {
		return this.app.entities.sync().then(() => {
			return this.sequelize.sync({ force: true })
		})
	}

	private _fetchData(entity: any, data?: any[], page?:number) {
		if ( ! page) {
			page = 1
		}
		if ( ! data ) {
			data = []
		}
		console.log(`fetch ${entity.name} page ${page}`)
		let realEntity = this.app.entities.get(entity.name)
		return realEntity.getQuery('list').run({page: page, limit: 20}, {raw: true}).then(rows => {
			console.log(`retrieve ${rows.data.length} rows`)
			console.log(rows)
			if ( ! rows.data ) {
				return data
			}
			data = data.concat(rows.data)
			this.backupInfo.current += rows.data.length
			this.backupInfo.progress = this.backupInfo.current * 100 / this.backupInfo.total
			if (this.backupInfo.callback) {
				this.backupInfo.callback(this.backupInfo.progress)
			}
			console.log(data)
			if ( rows.data.length == 20) {
				return this._fetchData(entity, data, page + 1)
			}
			else {
				return data
			}
		})
	}


	private _fetchAllData(entities: any[], i?:number) {
		if ( ! i ) {
			i = 0
		}

		return this._fetchData(entities[i]).then(data => {
			console.log(`fetched data`, data)
			entities[i].data = data
			if ( i + 1 < entities.length ) {
				return this._fetchAllData(entities, i + 1)
			}
			else return entities
		})
	}

	private _getTotalRows(total?: number, i?: number) {
		if ( ! i ) {
			i = 0
		}
		if ( ! total ) {
			total = 0
		}
		let entities = this.app.entities.findAll()
		return entities[i].getQuery('list').run({limit: 1}).then(res => {
			total += res.count
			if (i + 1 < entities.length) {
				return this._getTotalRows(total, i + 1)
			}
			else {
				return total
			}
		})
	}

	backup(callback):Promise<any> {
		this.backupInfo = {
			started: true,
			progress: 0,
			current: 0,
			total: undefined,
			callback: callback
		}

		let now = new Date()
		this.app.logger.log('(Backup) Creating backup dev-001.json')
		let entities = []

		this.app.entities.findAll().forEach(entity => {
			let json = entity.toJson()
			json.name = entity.name
			entities.push(json)
		})

		return this._getTotalRows().then(total => {
			this.backupInfo.total = total
			return this._fetchAllData(entities)
		}).then(entities => {
			console.log(entities)
			let today = new Date()
			let dd = today.getDate();
			let mm = today.getMonth()+1; //January is 0!
			let yyyy = today.getFullYear();
			let h = today.getHours();
			let m = today.getMinutes();

			let backupFile = path.join(this.app.path, '.materia', 'backups', `${this.app.mode}_${mm}-${dd}-${yyyy}_${h}-${m}.json`)
			return this.app.saveFile(backupFile, JSON.stringify(entities, null, 2), {mkdir: true})
		}).then(()=> {
			this.backupInfo.done = true
			return true
		})
	}

	restore(backup:any[]) {

	}
}
