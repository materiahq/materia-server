'use strict';

let Sequelize = require('sequelize')
let fs = require('fs')
let path = require('path')
let domain = require('domain')

let DatabaseInterface = require('./database/interface')

/**
 * @class Database
 * @classdesc
 * Represent the connection to database
 */
class Database {
	constructor(app) {
		this.app = app
		this.app.on('app:load', () => { this.load() })
		this.app.on('app:loaded', () => { this.start() })
		this.interface = new DatabaseInterface(this)
	}

	/**
	Get the database configuration
	@param {string} - *optional* The environment mode. `development` or `production`. Default to `development`
	@returns {object}
	*/
	getConfig(mode) {
		if ( ! this.settings) {
			throw new Error('The server is not configured yet.')
		}

		mode = mode || this.app.mode
		return this.settings[mode] || this.config
	}

	load(settings) {
		this.disabled = false
		if ( ! settings && this.app.path) {
			try {
				let content = fs.readFileSync(path.join(this.app.path, 'database.json'))
				settings = JSON.parse(content.toString())
			} catch (e) {
				if (e.code != 'ENOENT') {
					throw e
				}
			}
		}

		if ( ! settings) {
			this.disabled = true
			return false
		}

		this.settings = settings
		if (settings[this.app.mode]) {
			settings = settings[this.app.mode]
		}
		this.host = this.app.options['database-host'] || settings.host || 'localhost'
		this.port = Number(this.app.options['database-port'] || settings.port)
		this.username = this.app.options['database-username'] || settings.username
		this.password = this.app.options['database-password'] || settings.password
		this.database = this.app.options['database-db'] || settings.database
		this.storage = this.app.options['storage'] || settings.storage
		this.type = settings.type
		this.started = false

		let logging
		if (this.app.options.logSql == true)
			logging = this.app.log
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

	save(opts) {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		fs.writeFileSync(path.join(this.app.path, 'database.json'), JSON.stringify(this.toJson(), null, '\t'))
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	toJson() {
		let confToJson = (conf) => {
			if (conf.type != 'sqlite') {
				return {
					type: conf.type,
					host: conf.host,
					port: conf.port,
					database: conf.database,
					username: conf.username,
					password: conf.password
				}
			}
			else {
				let res = { type: conf.type }
				if (conf.storage && conf.storage != "database.sqlite") {
					res.storage = conf.storage
				}
				return res
			}
		}

		let res = confToJson(this.settings.dev || this)
		if (this.settings.prod)
			res.prod = confToJson(this.settings.prod)
		return res
	}

	/* deprecated: use load() + save() instead */
	setup(settings) {
		//console.log('SETUP DB', settings)
		if (this.load(settings)) {
			//console.log('db loaded, saving database.json')
			fs.writeFileSync(path.join(this.app.path, 'database.json'), JSON.stringify(settings, null, '\t'))
		}
	}

	/**
	Try to connect with a custom configuration
	@param {object} - The configuration object
	@returns {Promise}
	*/
	static try(settings) {
		if (settings.type == 'sqlite' && ! (this && this.app)) {
			return Promise.resolve() // admit okay if sqlite for a new app
		}
		let opts = {
			dialect: settings.type,
			host: settings.host,
			port: settings.port,
			logging: settings.logging
		}
		if (settings.type == 'sqlite') {
			opts.storage = path.resolve(this.app.path, settings.storage || 'database.sqlite')
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
	start() {
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
				this.app.warn('Impossible to connect the database:', e && e.message)
				this.app.warn('The database has been disabled')
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

	sync() {
		return this.app.entities.sync().then(() => {
			return this.sequelize.sync()
		})
	}

	forceSync() {
		return this.app.entities.sync().then(() => {
			return this.sequelize.sync({ force: true })
		})
	}
}

module.exports = Database
