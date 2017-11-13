import { AbstractDialect } from './abstract'
import { MateriaError } from '../../error'

export class PostgresDialect extends AbstractDialect {
	constructor(sequelize) {
		super(sequelize)
	}

	showTables() {
		let promises = []
		return this.sequelize.getQueryInterface().showAllTables().then((tables: Array<string>) => {
			for (let table of tables) {
				let queryInterface = this.sequelize.getQueryInterface()
				let qg = this.sequelize.getQueryInterface().QueryGenerator
				let infoQuery = queryInterface.describeTable(table)
				let indexQuery = queryInterface.showIndex(table)
				let fkQuery = this._getFKs(table)
				//let fkQuery = queryInterface.getForeignKeysForTables([table] )
				// getForeignKeysForTables not working:
				// https://github.com/sequelize/sequelize/issues/5748
				promises.push(infoQuery)
				promises.push(indexQuery)
				promises.push(fkQuery)
			}
			return Promise.all(promises).then((result) => {
				let res = {}

				/*tables.forEach((table, i) => {
					let info = result[i * 3];
					let indexes = result[i * 3 + 1];
					let fks = result[i * 3 + 2];

					console.log('----- %s -----', table)
					console.log('info', JSON.stringify(info,null,' '))
					console.log('indexes', JSON.stringify(indexes,null,' '))
					console.log('fks', JSON.stringify(fks,null,' '))
				})*/
				tables.forEach((table, i) => {
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
								field.fk = {
									entity: fk.table,
									field: fk.to
								}
								field.onUpdate = fk.on_update && fk.on_update.toUpperCase()
								field.onDelete = fk.on_delete && fk.on_delete.toUpperCase()
							}
						}
					}
					res[table] = fields
				})
				return res
			}).catch((e) => {
				let err = new MateriaError('Error when scanning database')
				err['originalError'] = e
				throw err
			})
		})
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
			`ALTER TABLE "${table}" ADD CONSTRAINT "${constraint.name}" ${constraint_type} ("${constraint.fields.join('", "')}")`
		)
	}

	dropConstraint(table, constraint):any {
		let queryInterface = this.sequelize.getQueryInterface()
		if (constraint.name) {
			return this.sequelize.query(
				`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint.name}"`
			).then(() => {
				return this.sequelize.getQueryInterface().removeIndex(
					table, constraint.name
				)
			})
		}
		else if (constraint.field) {
			if (constraint.type == "references") {
				return this._getFKs(table).then((fks) => {
					for (let fk of fks) {
						if (fk.from == constraint.field) {
							return this.sequelize.query(
								`ALTER TABLE "${table}" DROP CONSTRAINT "${fk.constraint_name}"`
							)
						}
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
									`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${index.name}"`
								).then(() => {
									return queryInterface.removeIndex(
										table, index.name
									)
								})
							})
						})(index)
					}
				}
				return p
			})
		}
	}

	castColumnType(table, column_name, old_type, type):any {
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