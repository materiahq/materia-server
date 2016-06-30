'use strict';
var Sequelize = require('sequelize')
var fs = require('fs')
var path = require('path')

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
		this.host = this.app.options['database-host'] || settings.host || 'localhost'
		this.port = Number(this.app.options['database-port'] || settings.port)
		this.username = this.app.options['database-username'] || settings.username
		this.password = this.app.options['database-password'] || settings.password
		this.database = this.app.options['database-db'] || settings.database
		this.type = settings.type
		this.started = false
		//this.models = []

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
			this.opts.storage = path.join(this.app.path, 'database.sqlite')
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
			fs.writeFileSync(path.join(this.app.path, 'database.json'), JSON.stringify(settings, null, '\t'))
		}
	}

	/**
	Try to connect with a custom configuration
	@param {object} - The configuration object
	@returns {Promise}
	*/
	try(settings) {
		let promise = new Promise((resolve, reject) => {
			let tmp = new Sequelize(settings.database, settings.username, settings.password, {
				dialect: settings.type,
				host: settings.host,
				port: settings.port,
				logging: settings.logging
			})
			tmp.authenticate().then(() => {
				tmp.close()
				resolve()
			}).catch((e) => {
				reject(e)
			})
		})
		return promise;
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
			this.app.emit('db:start')
			this.sequelize = new Sequelize(this.database, this.username, this.password, this.opts)
			let auth = this.sequelize.authenticate()
			auth.then(() => {
				this.app.emit('db:authorized')
				this.started = true
				this.app.emit('db:started')
				resolve()
			}).catch((e) => {
				reject(e)
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

	isSynced() {
		//return false if not this.started
		//if this.showTables().then (tables) ->
		//	console.log tables
		// TODO
	}

	/**
	Get the tables structure in database
	@returns {Promise<object>}
	*/
	showTables() {
		let promise = new Promise((resolve, reject) => {
			let promises = []
			this.sequelize.getQueryInterface().showAllTables()
				.catch((err) =>	{ console.error('SHOW TABLES ERR: ' + err); reject(err) })
				.then((tables) => {
					for (let table of tables) {
						let queryInterface = this.sequelize.getQueryInterface()
						let qg = this.sequelize.getQueryInterface().QueryGenerator
						let infoQuery = queryInterface.describeTable(table)
						let indexQuery = queryInterface.showIndex(table)
						let fkQuery = qg.getForeignKeysQuery(table, 'public')
						//let fkQuery = queryInterface.getForeignKeysForTables([table] )
						// getForeignKeysForTables not working:
						// https://github.com/sequelize/sequelize/issues/5748
						promises.push(infoQuery)
						promises.push(indexQuery)
						//promises.push(fkQuery)
						promises.push(this.sequelize.query(fkQuery))
					}
					Promise.all(promises).then((result) => {
						let res = {}
						/*
						for (let i in tables) {
							let table = tables[i]
							let info = result[i * 3];
							let indexes = result[i * 3 + 1];
							let fks = result[i * 3 + 2];

							console.log('----- %s -----', table)
							console.log('info', JSON.stringify(info,null,' '))
							console.log('indexes', JSON.stringify(indexes,null,' '))
							console.log('fks', JSON.stringify(fks,null,' '))
						}
						*/
						for (let i in tables) {
							let table = tables[i]
							let info = result[i * 3];
							let indexes = result[i * 3 + 1];
							let fks = result[i * 3 + 2];

							let fields = []
							for (let name in info) {
								info[name].name = name

								// don't trust describeTable (https://github.com/sequelize/sequelize/issues/5756)
								info[name].primaryKey = false

								fields.push(info[name])
							}

							for (let field of fields) {
								for (let index of indexes) {
									for (let ind of index.fields) {
										if (ind.attribute == field.name) {
											field.primaryKey = field.primaryKey || index.primary
											if (index.fields.length > 1) {
												field.unique = index.name
											}
											else {
												field.unique = field.unique || index.unique
											}
										}
									}
								}
								for (let fk of fks) {
									if (field.name == fk.from) {
										if (fk.table.substr(0,1) == '"')
											fk.table = fk.table.substr(1, fk.table.length - 2)
										if (fk.to.substr(0,1) == '"')
											fk.to = fk.to.substr(1, fk.to.length - 2)
										field.fk = {
											entity: fk.table,
											field: fk.to
										}
									}
								}
							}
							res[table] = fields
						}
						resolve(res)
					}).catch((e) => {
						console.error('Error when scanning database', e.stack)
						reject(e)
					})
				})
		})
		return promise
	}

	define(entity) {
		let defOptions = {
			freezeTableName: true
		}
		if (entity.createdAt != undefined) {
			defOptions.createdAt = entity.createdAt
		}
		if (entity.updatedAt != undefined) {
			defOptions.updatedAt = entity.updatedAt
		}
		return this.sequelize.define(entity.name, this._translateFields(entity.getFields()), defOptions)
	}

	sync() {
		this.app.entities.sync()
		return this.sequelize.sync()
	}

	forceSync() {
		this.app.entities.sync()
		return this.sequelize.sync({ force: true })
	}

	_translateType(type) {
		if ( ! type) {
			return Sequelize.TEXT
		}
		else if (type.toLowerCase() == 'date') {
			return Sequelize.DATE
		}
		else if (type.toLowerCase() == 'number') {
			return Sequelize.INTEGER
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

	_fromdbField(field) {
		let typemap = {
			'bigint': 'number',
			'bigserial': 'number',
			'integer': 'number',
			'int': 'number',
			'date': 'date',
			'datetime': 'date',
			'time with time zone': 'date',
			'time without time zone': 'date',
			'timestamp with time zone': 'date',
			'timestamp without time zone': 'date',
			'character varying': 'text',
			'text': 'text',
			'varchar': 'text',
			'double precision': 'float',
			'numeric': 'float',
			'boolean': 'boolean',
			'real': 'float',
			'smallint': 'number',
			'serial': 'number',
			'decimal': 'float'
		}
		let type = field.type.toLowerCase().replace(/\(.*\)/g,'')
		if ( ! typemap[type])
			throw new Error('Unknown type : "' + type + '"')

		let res = {
			name: field.name,
			type: typemap[type],
			primary: !! field.primaryKey,
			unique: field.unique || false,
			required: ! field.allowNull,
			read: true
		}
		//console.log('fromdb', field, res)

		res.default = false
		if (/nextval\(.+::regclass\)/.exec(field.defaultValue)) {
			res.autoIncrement = true
		} else if (field.defaultValue != undefined) {
			res.default = true
			let textValue = /['"](.*?)['"]?::text/.exec(field.defaultValue)
			if (textValue)
				res.defaultValue = textValue[1]
			else
				res.defaultValue = field.defaultValue
		}

		res.write = ! res.autoIncrement

		return res
	}

	_translateField(field) {
		let type = field.type || 'text'
		let res = {}
		if (field.type != undefined) {
			res.type = this._translateType(type)
		}
		if (field.primary != undefined) {
			res.primaryKey = field.primary
		}
		if (field.unique != undefined) {
			res.unique = field.unique
		}
		if (field.autoIncrement != undefined) {
			res.autoIncrement = field.autoIncrement
		}
		if (field.default == '$now' && type.toLowerCase() == 'date') {
			res.default = Sequelize.NOW
		}
		if (field.required != undefined) {
			res.allowNull = ! field.required
		}
		if (field.default != undefined) {
			res.default = field.default
		}

		if (field.defaultValue != undefined) {
			if ( ! isNaN(field.defaultValue) || type.toLowerCase() != 'number') {
				res.defaultValue = field.defaultValue
			}
		}

		if (field.isRelation) {
			if (field.isRelation.type == 'belongsTo') {
				res.references = {
					model: field.isRelation.reference.entity,
					key: field.isRelation.reference.field
				}
				res.onUpdate = 'cascade'
			}
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
