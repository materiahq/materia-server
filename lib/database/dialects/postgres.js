'use strict'

const AbstractDialect = require('./abstract')

class PostgresDialect extends AbstractDialect {
	constructor(sequelize) {
		super(sequelize)
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

						/*for (let i in tables) {
							let table = tables[i]
							let info = result[i * 3];
							let indexes = result[i * 3 + 1];
							let fks = result[i * 3 + 2];

							console.log('----- %s -----', table)
							console.log('info', JSON.stringify(info,null,' '))
							console.log('indexes', JSON.stringify(indexes,null,' '))
							console.log('fks', JSON.stringify(fks,null,' '))
						}*/

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

	// TODO: remove and use abstract getIndices instead of postgres' one ?
	/*getIndices(table) {
		let query = this.sequelize.getQueryInterface().QueryGenerator.showIndexesQuery(table)
		return this.sequelize.query(query).then((res) => {
			let fields = {}
			for (let index of res[0]) {
				let inds = index.indkey.split(' ');
				let column_names = index.column_names.substr(1, index.column_names.length - 2).split(',')
				index.fields = []
				for (let ind of inds) {
					let name = column_names[index.column_indexes.indexOf(parseInt(ind))]
					index.fields.push(name)
				}
				for (let ind of inds) {
					let name = column_names[index.column_indexes.indexOf(parseInt(ind))]
					fields[name] = fields[name] || []
					fields[name].push(index)
				}
			}
			return Promise.resolve(fields)
		})
	}*/
	// -----

	addConstraint(table, constraint) {
		const constraint_type = (constraint.type == "primary") ? "PRIMARY KEY" : "UNIQUE"
		if (constraint.type == "primary") {
			constraint.name = table + "_pkey"
		} else if ( ! constraint.name) {
			constraint.name = constraint.fields.join('_') + '_' + table + '_key'
		}
		return this.sequelize.query(
			`ALTER TABLE ${table} ADD CONSTRAINT ${constraint.name} ${constraint_type} (${constraint.fields.join(', ')})`
		)
	}

	dropConstraint(table, constraint) {
		if (constraint.name) {
			return this.sequelize.query(
				'ALTER TABLE ' + table + ' DROP CONSTRAINT IF EXISTS ' + constraint.name
			).then(() => {
				return this.sequelize.getQueryInterface().removeIndex(
					table, constraint.name
				)
			})
		}
		else if (constraint.field) {
			if (constraint.type == "references") {
				return this.getFKs(table).then((fks) => {
					if (fks[constraint.field]) {
						return this.sequelize.query(
							`ALTER TABLE ${table} DROP CONSTRAINT ` + fks[constraint.name].constraint_name
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
									`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${index.name}`
								).then(() => {
									return queryInterface.removeIndex(
										table, index.name
									)
								})
							})

							let unique_names = index.fields.filter((x) => { return x != constraint.field })
							if (unique_names.length) {
								p = p.then(() => {
									const constraint_type = (constraint.type == "primary") ? "PRIMARY KEY" : "UNIQUE"
									return this.sequelize.query(
										`ALTER TABLE ${table} ADD CONSTRAINT ${index.name} ${constraint_type} (${unique_names.join(',')})`
									)
								})
							}
						})(index)
					}
				}
				return p
			})
		}
	}

	castColumnType(table, column_name, old_type, type) {
		let queryCast

		if (type == "number") {
			type = "integer"
			if (old_type == "text" || ! old_type) {
				queryCast = "trim(" + column_name + ")::integer"
			}
			else if (old_type == "date") {
				queryCast = "extract(epoch from " + column_name + ")::integer"
			}
		}
		else if (type == "float") {
			type = "double precision"
			if (old_type == "text" || ! old_type) {
				queryCast = "(trim(" + column_name + ")::double precision)"
			}
			else if (old_type == "date") {
				queryCast = "(extract(epoch from " + column_name + ")::double precision)"
			}
		}
		else if (type == "boolean") {
			if (old_type == "text" || ! old_type) {
				queryCast = "CASE lower(" + column_name + ") WHEN 'false' THEN FALSE WHEN '0' THEN FALSE WHEN 'f' THEN FALSE WHEN 'n' THEN FALSE WHEN 'no' THEN FALSE ELSE TRUE END"
			} else if (old_type == "number" || old_type == "float") {
				queryCast = "CASE " + column_name + " WHEN 0 THEN FALSE ELSE TRUE END"
			}
		}
		else if (type == "date") {
			type = "timestamp with time zone"
			if (old_type == "text" || ! old_type) {
				queryCast = "to_timestamp(trim(" + column_name + ")::integer)"
			} else if (old_type == "number" || old_type == "float") {
				queryCast = "to_timestamp(" + column_name + ")"
			}
		}
		else if (type == "text") {
			if (old_type == "date") {
				queryCast = "extract(epoch from " + column_name + ")"
			}
		}

		if (queryCast) {
			return this.sequelize.query(
				`ALTER TABLE ${table} ALTER COLUMN "${column_name}" TYPE ${type} USING ${queryCast}`
			).then(() => {
				return true
			})
		} else {
			return Promise.resolve(false)
		}
	}
}

module.exports = PostgresDialect