'use strict';
var Sequelize = require('sequelize')
var fs = require('fs')
var path = require('path')

class Database {
	constructor(app) {
		this.app = app
		this.app.on('app:load', () => { this.load() })
		this.app.on('app:loaded', () => { this.start() })
	}

	getConfig(mode) {
		if ( ! this.settings) {
			throw 'The server is not configured yet.'
		}

		if ( ! mode) {
			mode = this.app.mode
		}

		let result;
		if (this.config[mode]) {
			result = this.config[mode]
		}
		result = this.config
		return result
	}

	load(settings) {
		if ( ! settings && this.app.path) {
			//console.log('\nLoading database configuration...')
			try {
				let content = fs.readFileSync(path.join(this.app.path, 'database.json'))
				settings = JSON.parse(content.toString())
			} catch (e) {
				//console.log('database.json is missing')
			}
		}
		if ( ! settings) {
			return false
		}

		if (settings[this.app.mode]) {
			settings = settings[this.app.mode]
		}
		//console.log(settings)
		this.host = settings.host || 'localhost'
		this.port = Number(settings.port)
		this.username = settings.username
		this.password = settings.password
		this.database = settings.database
		this.type = settings.type
		this.started = false
		//this.models = []
		this.opts = {
 			dialect: this.type,
			host: this.host,
			port: this.port,
			//logging: false
		}

		if (this.type == 'sqlite') {
			this.opts.storage = path.join(this.app.path, 'database.sqlite')
		}
		return true
	}

	save() {
		fs.writeFileSync(path.join(this.app.path, 'database.json'), JSON.stringify(this.toJson(), null, 2))
	}

	toJson() {
		let res = {
			host: this.host,
			port: this.port,
			username: this.username,
			password: this.password,
			database: this.database,
			type: this.type
		}
		return res;
	}

	/* deprecated: use load() + save() instead */
	setup(settings) {
		//console.log('SETUP DB', settings)
		if (this.load(settings)) {
			//console.log('db loaded, saving database.json')
			fs.writeFileSync(path.join(this.app.path, 'database.json'), JSON.stringify(settings, null, 2))
		}
	}

	start() {
		if (this.sequelize) {
			this.stop()
		}

		let promise = new Promise((resolve, reject) => {
			this.app.emit('db:start')
			this.sequelize = new Sequelize(this.database, this.username, this.password, this.opts)
			let auth = this.sequelize.authenticate()
			auth.then(() => {
				this.app.emit('db:authorized')
				//TODO: put this in entities/index.js
				this.sync().then(() => {
					this.started = true
					this.app.emit('db:started')
					resolve()
				}).catch((e) => {
					reject(e)
				})
			}).catch((e) => {
				reject(e)
			})
		})
		return promise
	}

	isSynced() {
		//return false if not this.started
		//if this.showTables().then (tables) ->
		//	console.log tables
		// TODO
	}

	showTables() {
		let st = this.sequelize.getQueryInterface().QueryGenerator.showTablesQuery()
		//console.log(st)
		this.sequelize.query(st)
			.catch((err) =>	{ console.log('SHOW TABLES ERR: ' + err) })
			.then((tables) => { console.log('SHOW TABLES', tables) })
	}

	stop() {
		this.started = false
		if (this.sequelize) {
			this.sequelize.close()
			this.sequelize = null
		}
	}

	define(entity) {
		return this.sequelize.define(entity.name, this._translateFields(entity.getFields()), {
			freezeTableName: true
		})
	}

	sync() {
		//TODO: if this.isSync() ... merge db with entities
		this.app.entities.sync()
		return this.sequelize.sync() //force: true
	}

	forceSync() {
		this.app.entities.sync()
		return this.sequelize.sync({ force: true })
	}

	_translateType(type) {
		if ( ! type) {
			return Sequelize.STRING
		}
		else if (type.toLowerCase() == 'date') {
			return Sequelize.DATE
		}
		else if (type.toLowerCase() == 'number') {
			return Sequelize.INTEGER
		}
		else if (type.toLowerCase() == 'string') {
			return Sequelize.STRING
		}
		else if (type.toLowerCase() == 'boolean') {
			return Sequelize.BOOLEAN
		}
		else if (type.toLowerCase() == 'float') {
			return Sequelize.FLOAT
		}
		else {
			return Sequelize.TEXT
		}
	}
	
	_translateField(field) {
		let type = field.type || 'string'
		let res = { type: this._translateType(type) }
		if (field.primary) {
			res.primaryKey = true
		}
		if (field.unique) {
			res.unique = true
		}
		if (field.autoIncrement) {
			res.autoIncrement = true
		}
		if (field.default == '$now' && type.toLowerCase() == 'date') {
			res.default = Sequelize.NOW
		}
		res.allowNull = ! Boolean(field.required)
		if (field.defaultValue) {
			res.defaultValue = field.defaultValue
		}

		if (isNaN(res.defaultValue) && type.toLowerCase() == 'number') {
			delete res.defaultValue
		}
		
		return res
	}

	_translateFields(fields) {
		let res = {}
		fields.forEach((field) => {
			res[field.name] = this._translateField(field)
		})
		return res
	}
}

module.exports = Database
