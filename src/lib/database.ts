import * as fs from 'fs'
import * as path from 'path'
import chalk from 'chalk'

import * as Sequelize from 'sequelize'

let domain = require('domain')

import { App, AppMode } from './app'

import { ConfigType } from './config'

import { IDatabaseConfig, ISQLDatabase, ISQLiteDatabase } from '@materia/interfaces'

import { DatabaseInterface } from './database/interface'
import { MateriaError } from './error'

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

const dialect = {
	postgres: "PostgreSQL",
	mysql: "MySQL",
	sqlite: "SQLite"
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

	constructor(private app: App) {
		this.interface = new DatabaseInterface(this)
	}

	static isSQL(settings: IDatabaseConfig): settings is ISQLDatabase {
		return settings.type != "sqlite"
	}
	static isSQLite(settings: IDatabaseConfig): settings is ISQLiteDatabase {
		return settings.type == "sqlite"
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

		if ( ! settings || ! settings.type ) {
			this.disabled = true
			this.app.logger.log(` └── Database: ${chalk.yellow.bold('No database configured!')}`)
			return false
		}
		if (Database.isSQL(settings)) {
			this.host = this.app.options['database-host'] || settings.host || 'localhost'
			this.port = Number(this.app.options['database-port'] || settings.port)
			this.username = this.app.options['database-username'] || settings.username
			this.password = this.app.options['database-password'] || settings.password
			this.database = this.app.options['database-db'] || settings.database
		} else if (Database.isSQLite(settings)) {
			this.storage = this.app.options['storage'] || settings.storage
		}

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

		if (Database.isSQLite(settings)) {
			this.opts.storage = path.resolve(this.app.path, this.storage || 'database.sqlite')
		}

		if (this.app.mode == AppMode.PRODUCTION && process.env.GCLOUD_PROJECT && this.type == 'mysql') {
			try {
				let gcloudJsonPath = path.join(this.app.path, '.materia', 'gcloud.json')
				if (fs.existsSync(gcloudJsonPath)) {
					let gcloudSettings = JSON.parse(fs.readFileSync(gcloudJsonPath, 'utf-8'))
					this.opts.dialectOptions = { socketPath: `/cloudsql/${gcloudSettings.project}:${gcloudSettings.region}:${gcloudSettings.instance}` }
					delete this.opts.host
					delete this.opts.port
				}
				else {
					throw 'gcloud.json not found'
				}
			}
			catch (e) {
				this.app.logger.log(chalk.yellow(` └── Warning: Impossible to load GCloud database settings - ${chalk.bold(e)}`))
			}
		}

		this.app.logger.log(` └─┬ Database: ${chalk.green.bold('OK')}`)
		this.app.logger.log(` │ └── Dialect: ${chalk.bold(dialect[this.type])}`)
		if (this.type == 'sqlite') {
			this.app.logger.log(` │ └── File: ${chalk.bold(this.storage || 'database.sqlite')}`)
		} else {
			this.app.logger.log(` │ └── Host: ${chalk.bold(this.host)}`)
			this.app.logger.log(` │ └── Port: ${chalk.bold(this.port.toString())}`)
		}

		return true
	}

	_confToJson(conf:IDatabaseConfig):IDatabaseConfig {
		if ( ! conf ) {
			return null
		}
		if (Database.isSQL(conf)) {
			return {
				type: conf.type,
				host: conf.host,
				port: conf.port,
				database: conf.database,
				username: conf.username,
				password: conf.password
			}
		}
		else if (Database.isSQLite(conf)) {
			return {
				type: conf.type,
				storage: conf.storage
			};
		}
	}

	/**
	Try to connect with a custom configuration
	@param {object} - The configuration object
	@returns {Promise}
	*/
	static tryDatabase(settings: IDatabaseConfig, app?: App): Promise<void> {

		//TODO: check settings.storage to be a real path
		if (this.isSQLite(settings) && settings.storage) {
			return Promise.resolve()
		}

		const optsDialect = {
			dialect: settings.type,
			logging: false
		}
		let opts: ISequelizeConfig;
		if (Database.isSQL(settings)) {
			opts = Object.assign({}, optsDialect, {
				host: settings.host,
				port: settings.port
			})
		} else if (Database.isSQLite(settings) && app) {
			opts.storage = path.resolve(app.path, settings.storage || 'database.sqlite')
		}
		let tmp
		return new Promise((accept, reject) => {
			let d = domain.create()
			try {
				if (Database.isSQL(settings)) {
					tmp = new Sequelize(settings.database, settings.username, settings.password, opts)
				} else if (Database.isSQLite(settings)) {
					tmp = new Sequelize(null, null, null, opts)
				}
			} catch (e) {
				return reject(e)
			}
			d.add(tmp.query)
			d.on('error', (e) => {
				d.remove(tmp.query)
				reject(e)
			})
			d.run(() => {
				tmp.authenticate().then(() => {
					tmp.close()
					accept()
				}).catch((e) => { reject(e) })
			})
		})
	}

	/**
	Try to connect database server default database with username password
	MySQL or PostgreSQL only
	@param {object} - The configuration object
	@returns {Promise}
	 */

	static tryServer(settings: IDatabaseConfig, app?: App) {
		if (Database.isSQL(settings)) {
			let opts: ISequelizeConfig = {
				dialect: settings.type,
				host: settings.host,
				port: settings.port,
				logging: false
			}
			let tmp
			let defaultDatabase
			if (settings.type == 'mysql') {
				defaultDatabase = 'sys'
			} else if (settings.type == 'postgres') {
				defaultDatabase = 'postgres'
			}
			return new Promise((accept, reject) => {
				let d = domain.create()
				try {
					tmp = new Sequelize(defaultDatabase, settings.username, settings.password, opts)
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
		} else {
			return Promise.reject(new Error("You can't try to connect to SQLite with username/password"));
		}
	}


	/**
	List databases in mysql or postgres instances
	MySQL and PostgreSQL only
	@param settings - The configuration object
	@returns {Promise}
	 */
	static listDatabases(settings: IDatabaseConfig) {
		if (Database.isSQL(settings)) {
			let opts: ISequelizeConfig = {
				dialect: settings.type,
				host: settings.host,
				port: settings.port,
				logging: false
			}
			let tmp
			let defaultDatabase
			if (settings.type == 'mysql') {
				defaultDatabase = 'sys'
			} else if (settings.type == 'postgres') {
				defaultDatabase = 'postgres'
			}
			return new Promise((accept, reject) => {
				domain.create()
				try {
					tmp = new Sequelize(defaultDatabase, settings.username, settings.password, opts)
					if (settings.type == 'mysql') {
						tmp.query(`SHOW DATABASES`).spread((results, metadata)=> {
									let formatedResult = []
							for (let i in results) {
								let result = results[i]
								formatedResult.push(result.Database)
							}
							return accept(formatedResult)
						})
					} else if (settings.type == 'postgres') {
						tmp.query(`SELECT datname FROM pg_database`).spread((results, metadata)=> {
							let formatedResult = []
							for (let i in results) {
								let result = results[i]
								formatedResult.push(result.datname)
							}
							return accept(formatedResult)
						})
					}
				} catch (e) {
					return reject(e)
				}
			})
		} else {
			return Promise.reject(new Error(`You can't list database on a SQLite database`))
		}
	}

	/**
	 Create new database in mysql or postgresql instances
	 @param settings - The configuration object
	 @param name - Name for the new database
	 */
	static createDatabase(settings, name) {
		let opts: ISequelizeConfig = {
			dialect: settings.type,
			host: settings.host,
			port: settings.port,
			logging: false
		}
		let tmp
		let defaultDatabase
		if (settings.type == 'mysql') {
			defaultDatabase = 'sys'
		} else if (settings.type == 'postgres') {
			defaultDatabase = 'postgres'
		}
		return new Promise((accept, reject) => {
			domain.create()
			try {
				tmp = new Sequelize(defaultDatabase, settings.username, settings.password, opts)
				const dbName = defaultDatabase === 'sys' ? "`" + `${name}` + "`" : `"${name}"`;
				tmp.query(`CREATE DATABASE ${dbName}`).spread((results, metadata) => {
					return accept()
				})
			} catch (e) {
				return reject(e)
			}
		})
	}

	tryDatabase(settings) {
		return Database.tryDatabase(settings, this.app)
	}

	tryServer(settings) {
		return Database.tryServer(settings, this.app)
	}

	listDatabases(settings) {
		return Database.listDatabases(settings)
	}

	createDatabase(settings, name) {
		return Database.createDatabase(settings, name)
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
			this.disabled = true
			return Promise.reject(e)
		}
		this.interface.setDialect(this.type)
		return this.interface.authenticate().then(() => {
			this.app.logger.log(` └── Database: ${chalk.green.bold('Authenticated')}`)

			this.started = true
		}).catch((e) => {
			this.app.logger.error(` └── Database: ${chalk.red.bold('Connection failed')}`)
			this.app.logger.error(chalk.red('    (Warning) Impossible to connect the database: ') + chalk.red.bold(e && e.message))
			this.app.logger.error(chalk.red('    The database has been disabled'))
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
		return Promise.resolve()
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
