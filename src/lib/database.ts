import * as fs from 'fs'
import * as path from 'path'

import * as Sequelize from 'sequelize'

let domain = require('domain')

import App, { AppMode, ISaveOptions } from './app'

import { DatabaseInterface } from './database/interface'

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
}

export interface IBasicDatabaseConfig {
	host?: string,
	port?: number,
	username?: string
	password?: string
	database?: string
	type: string
	storage?: string
}

export interface IDatabaseConfig {
	dev: IBasicDatabaseConfig,
	prod?: IBasicDatabaseConfig
}

/**
 * @class Database
 * @classdesc
 * Represent the connection to database
 */
export class Database {
	interface: DatabaseInterface

	settings: IDatabaseConfig
	disabled: boolean

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

	constructor(private app: App) {
		this.interface = new DatabaseInterface(this)
	}

	/**
	Get the database configuration
	@param {string} - *optional* The environment mode. `development` or `production`. Default to `development`
	@returns {object}
	*/
	getConfig(mode?: AppMode):IBasicDatabaseConfig {
		if ( ! this.settings) {
			throw new Error('The server is not configured yet.')
		}

		mode = mode || this.app.mode

		return this.settings[mode]
	}

	/**
	Load the database configuration
	@param {object} - *optional* The settings of the database
	@returns {object}
	*/
	load(settings?: any):boolean {
		this.disabled = false
		if ( ! settings && this.app.path) {
			try {
				let content = fs.readFileSync(path.join(this.app.path, 'database.json'))
				settings = JSON.parse(content.toString())
			} catch (e) {
				if (e.code != 'ENOENT') {
					this.disabled = true
					throw e
				}
			}
		}

		if ( ! settings) {
			this.disabled = true
			return false
		}

		if ( settings && ! settings.dev ) {
			this.settings = {
				dev: null,
				prod: null
			}
			this.settings[this.app.mode] = settings
		}
		else {
			this.settings = settings;
		}

		let modeSetting = this.settings[this.app.mode]

		this.host = this.app.options['database-host'] || modeSetting.host || 'localhost'
		this.port = Number(this.app.options['database-port'] || modeSetting.port)
		this.username = this.app.options['database-username'] || modeSetting.username
		this.password = this.app.options['database-password'] || modeSetting.password
		this.database = this.app.options['database-db'] || modeSetting.database
		this.storage = this.app.options['storage'] || modeSetting.storage
		this.type = modeSetting.type
		this.started = false

		let logging: any
		if (this.app.options.logSql == true)
			logging = this.app.logger.log
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
		return true
	}

	/**
	 *
	 */
	save(opts?: ISaveOptions) {
		if (opts && opts.beforeSave) {
			opts.beforeSave('database.json')
		}
		fs.writeFileSync(path.join(this.app.path, 'database.json'), JSON.stringify(this.toJson(), null, '\t'))
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	private confToJson(conf:IBasicDatabaseConfig):IBasicDatabaseConfig {
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
			} as IBasicDatabaseConfig
		}
		else {
			let res: IBasicDatabaseConfig = {
				type: conf.type,
				storage: null
			}
			if (conf.storage && conf.storage != "database.sqlite") {
				res.storage = conf.storage
			}
			return res
		}
	}

	toJson():IDatabaseConfig {
		let res: IDatabaseConfig = {
			dev: this.confToJson(this.settings.dev),
			prod: this.confToJson(this.settings.prod)
		}
		return res;
	}

	/* deprecated: use load() + save() instead */
	setup(settings: IDatabaseConfig):void {
		if (this.load(settings)) {
			this.save();
		}
	}

	/**
	Try to connect with a custom configuration
	@param {object} - The configuration object
	@returns {Promise}
	*/
	static try(settings: IBasicDatabaseConfig, app?: App) {

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
		return Database.try.call(this, settings)
	}

	/**
	Connect to the database
	@returns {Promise}
	*/
	start():Promise<any> {
		if (this.sequelize) {
			this.stop()
		}

		let promise = new Promise((resolve, reject) => {
			if ( this.disabled ) {
				return resolve()
			}
			if ( ! this.interface.hasDialect(this.type)) {
				return reject(new Error('The database\'s dialect is not supported'))
			}
			this.app.emit('db:start')
			try {
				this.sequelize = new Sequelize(this.database, this.username, this.password, this.opts)
			}
			catch(e) {
				return reject(e)
			}
			this.interface.setDialect(this.type)
			let auth = this.sequelize.authenticate()
			auth.then(() => {
				this.app.emit('db:authorized')
				this.started = true
				this.app.emit('db:started')
				resolve()
			}).catch((e) => {
				this.app.logger.warn('Impossible to connect the database:', e && e.message)
				this.app.logger.warn('The database has been disabled')
				this.disabled = true
				resolve(e)
			})
		})
		return promise
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
	sync() {
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
}
