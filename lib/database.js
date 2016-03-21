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
			logging = console.log
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

	save() {
		fs.writeFileSync(path.join(this.app.path, 'database.json'), JSON.stringify(this.toJson(), null, '\t'))
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

	try(settings) {
		let promise = new Promise((resolve, reject) => {
			console.log('try connect db with settings: ', settings);
			let tmp = new Sequelize(settings.database, settings.username, settings.password, {
				dialect: settings.type,
				host: settings.host,
				port: settings.port,
				logging: settings.logging
			})
			tmp.authenticate().then(() => {
				console.log('auth')
				tmp.close()
				resolve()
			}).catch((e) => {
				console.log('not auth', e);
				reject(e)
			})
		})
		return promise;
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
		let promise = new Promise((resolve, reject) => {
			let st = this.sequelize.getQueryInterface().QueryGenerator.showTablesQuery()
			//console.log(st)
			let promises = []
			this.sequelize.query(st)
				.catch((err) =>	{ console.log('SHOW TABLES ERR: ' + err); reject(err) })
				.then((tables) => {
					for (let table of tables) {
						let qg = this.sequelize.getQueryInterface().QueryGenerator;
						let infoQuery = qg.describeTableQuery(table[0]);
						let indexQuery = qg.showIndexesQuery(table[0])
						let fkQuery = qg.getForeignKeysQuery(table[0], 'public')
						promises.push(this.sequelize.query(infoQuery))
						promises.push(this.sequelize.query(indexQuery))
						promises.push(this.sequelize.query(fkQuery))
					}
					Promise.all(promises).then((result) => {
						let res = {}
						for (let i in tables) {
							let table = tables[i][0];
							let info = result[i * 3][0];
							let indexes = result[i * 3 + 1][0];
							let fks = result[i * 3 + 2];
							//console.log(info);
							for (let field of info) {
								//console.log(field);
								for (let index of indexes) {
									let inds = index.indkey.split(' ');
									for (let ind of inds) {
										let f = index.column_names.split(',')[index.column_indexes.indexOf(parseInt(index.indkey))]
										//console.log('field', index.column_names.split(',')[index.column_indexes.indexOf(parseInt(index.indkey))])
										if (f == field.Field) {
											field.primary = index.primary
											field.unique = index.unique
										}
										//if (table == "user_permission") {
										//    console.log('index', index);
										//}
									}
								}
								for (let fk of fks) {
									if (field.Field == fk.from) {
										field.fk = true
										field.fkTable = fk.table.substr(1, fk.table.length - 2)
										field.fkTo = fk.to
									}
								}
							}
							res[table] = info
							//console.log('table', table, res)
							//console.log('info', info)
						}
						//console.log(res);
						resolve(res)
					})
				})
		})
		return promise
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
		//this.showTables().then((tables) => {
		//    let diff = this.diff(tables, this.app.entities.findAll(), false)
			//this.app.applyDiff(diff) ou qqc du genre
		//});
		this.app.entities.sync()
		return this.sequelize.sync()
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
			'integer': 'number',
			'timestamp with time zone': 'date',
			'character varying': 'text',
			'text': 'text',
			'double precision': 'float',
			'boolean': 'boolean'
		}
		if ( ! typemap[field.Type])
			throw new Error('Unknown type : "' + field.Type + '"')

		let res = {
			name: field.Field,
			type: typemap[field.Type],
			primary: !! field.primary,
			unique: !! field.unique,
			required: field.Null == "NO",
			read: true
		}

		res.default = false
		if (/nextval\('.+'::regclass\)/.exec(field.Default)) {
			res.autoIncrement = true
		} else if (field.Default != undefined) {
			res.default = true
			res.defaultValue = field.Default
		}

		res.write = ! res.autoIncrement

		return res
	}

	_translateField(field) {
		let type = field.type || 'text'
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
		if (field.default && field.defaultValue != undefined) {
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
