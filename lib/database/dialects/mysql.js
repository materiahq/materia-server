'use strict'

const AbstractDialect = require('./abstract')

class MysqlDialect extends AbstractDialect {
	constructor(sequelize) {
		super(sequelize)
	}

	_describeTable(table) {
		let qg = this.sequelize.getQueryInterface().QueryGenerator
		let sql = qg.describeTableQuery(table)
		return this.sequelize.query(sql, {raw:true}).then((desc) => {
			let data = desc[0]
			let result = {}

			const enumRegex = /^enum/i
			for (const _result of data) {
				result[_result.Field] = {
					type: enumRegex.test(_result.Type) ? _result.Type.replace(enumRegex, 'ENUM') : _result.Type.toUpperCase(),
					allowNull: (_result.Null === 'YES'),
					defaultValue: _result.Default,
					primaryKey: _result.Key === 'PRI',
					autoIncrement: _result.Extra === 'auto_increment'
				}
			}

			return result
		})
	}

	_getFKs(table) {
		let query = "SELECT CONSTRAINT_NAME as `constraint_name`, COLUMN_NAME as `from`, REFERENCED_TABLE_NAME as `table`, " +
					"REFERENCED_COLUMN_NAME as `to` FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE " +
					"WHERE TABLE_NAME = '" + table + "' AND REFERENCED_TABLE_NAME IS NOT NULL"
		return this.sequelize.query(query, {raw:true}).then((res) => {
			return Promise.resolve(res[0])
		})
	}

	getFKs(table) {
		return this._getFKs(table).then((res) => {
			let fields = {}
			for (let fk of res) {
				fields[fk.from] = fk
			}
			return Promise.resolve(fields)
		})
	}

	showTables() {
		let promise = new Promise((resolve, reject) => {
			let promises = []
			this.sequelize.getQueryInterface().showAllTables()
				.catch((err) =>	{ console.error('SHOW TABLES ERR: ' + err); reject(err) })
				.then((tables) => {
					for (let table of tables) {
						let queryInterface = this.sequelize.getQueryInterface()
						let qg = this.sequelize.getQueryInterface().QueryGenerator
						let infoQuery = this._describeTable(table)
						let indexQuery = queryInterface.showIndex(table)
						let fkQuery = this._getFKs(table)
						//let fkQuery = qg.getForeignKeysQuery(table)
						//let fkQuery = queryInterface.getForeignKeysForTables([table])
						// neither getForeignKeysQuery nor getForeignKeysForTables are working for mysql:
						// https://github.com/sequelize/sequelize/issues/5748
						promises.push(infoQuery)
						promises.push(indexQuery)
						promises.push(fkQuery)
					}
					Promise.all(promises).then((result) => {
						let res = {}

						/*for (let i in tables) {
							let table = tables[i]
							let info = result[i * 3];
							let indexes = result[i * 3 + 1];
							let fks = result[i * 3 + 2];

							console.log('----- %s -----', table)
							console.log('info', JSON.stringify(info,null,' '))
							console.log('indexes', JSON.stringify(indexes,null,' '))
							console.log('fks', JSON.stringify(fks,null,' '))
							console.log(fks);
						}*/

						for (let i in tables) {
							let table = tables[i]
							let info = result[i * 3];
							let indexes = result[i * 3 + 1];
							let fks = result[i * 3 + 2];

							let fields = []
							for (let name in info) {
								info[name].name = name

								// Do not trust describe but only indices
								info[name].primaryKey = false

								fields.push(info[name])
							}

							for (let field of fields) {
								for (let index of indexes) {
									for (let ind of index.fields) {
										if (ind.attribute == field.name) {
											field.primaryKey = field.primaryKey || index.primary
											if ( ! index.primary && index.fields.length > 1) {
												field.unique = index.name
											}
											else {
												field.unique = field.unique || index.unique
											}
										}
									}
								}
								if (field.type == "JSON") {
									field.type = ["JSON", "TEXT"]
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

	addConstraint(table, constraint) {
		if (constraint.type != "primary" && ! constraint.name) {
			constraint.name = constraint.fields.join('_') + '_' + table + '_key'
		}
		const constraint_sql = (constraint.type == "primary") ? "PRIMARY KEY" : `CONSTRAINT ${constraint.name} UNIQUE`
		return this.sequelize.query(
			`ALTER TABLE ${table} ADD ${constraint_sql} (${constraint.fields.join(', ')})`
		)
	}

	dropConstraint(table, constraint) {
		if (constraint.name) {
			return this.sequelize.getQueryInterface().showIndex(table).then((res) => {
				for (let index of res) {
					if (index.name == constraint.name) {
						return this.sequelize.getQueryInterface().removeIndex(
							table, constraint.name
						)
					}
				}
				return Promise.resolve()
			})
		} else if (constraint.type == "primary") {
			return this.sequelize.query(
				`ALTER TABLE ${table} DROP PRIMARY KEY`
			)
		} else if (constraint.field) {
			if (constraint.type == "references") {
				return this.getFKs(table).then((fks) => {
					if (fks[constraint.field]) {
						return this.sequelize.query(
							`ALTER TABLE ${table} DROP FOREIGN KEY ` + fks[constraint.field].constraint_name
						)
					}
				})
			}
			return this.getIndices(table).then((fields) => {
				if ( ! fields[constraint.field])
					return Promise.resolve()
				let p = Promise.resolve()
				for (let index of fields[constraint.field]) {
					if (index.unique) {
						;((index) => {
							p = p.then(() => {
								return this.sequelize.query(
									`ALTER TABLE ${table} DROP INDEX ${index.name}`
								)
							})
						})(index)
					}
				}
				return p
			})
		}
	}
}

module.exports = MysqlDialect