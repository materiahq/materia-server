import { AbstractDialect } from './abstract'
import { MateriaError } from '../../error'

import * as Sequelize from 'sequelize'

export class SqliteDialect extends AbstractDialect {
	constructor(sequelize) {
		super(sequelize)
	}

	showTables() {
		let promises = []
		return this.sequelize.getQueryInterface().showAllTables().then((tables: Array<string>) => {
			tables.forEach(table => {
				let queryInterface = this.sequelize.getQueryInterface()
				let qg = this.sequelize.getQueryInterface().QueryGenerator
				let infoQuery = queryInterface.describeTable(table)
				let indexQuery = queryInterface.showIndex(table)
				let fkQuery = qg.getForeignKeysQuery(table, 'public')
				//let fkQuery = queryInterface.getForeignKeysForTables([table] )
				// getForeignKeysForTables not working:
				// https://github.com/sequelize/sequelize/issues/5748

				let aiQuery = this.sequelize.query(`SELECT 1 as name FROM sqlite_master WHERE type = 'table' AND name = ? AND sql LIKE '%AUTOINCREMENT%'`, { replacements: [table], raw:true, plain:true })
				promises.push(infoQuery)
				promises.push(indexQuery)
				//promises.push(fkQuery)
				promises.push(this.sequelize.query(fkQuery))
				promises.push(aiQuery)
			})
			return Promise.all(promises).then((result) => {
				let res = {}

				/*
				tables.forEach((table, i) => {
					let info = result[i * 4]
					let indexes = result[i * 4 + 1]
					let fks = result[i * 4 + 2]
					let hasAi = result[i * 4 + 3][0]

					console.log('----- %s -----', table)
					console.log('info', JSON.stringify(info,null,' '))
					console.log('indexes', JSON.stringify(indexes,null,' '))
					console.log('fks', JSON.stringify(fks,null,' '))
					console.log('hasAi', JSON.stringify(hasAi,null,' '))
				})*/
				tables.forEach((table, i) => {
					let info = result[i * 4]
					let indexes = result[i * 4 + 1]
					let fks = result[i * 4 + 2]
					let hasAi = result[i * 4 + 3][0]

					let fields = []
					for (let name in info) {
						info[name].name = name
						fields.push(info[name])
					}

					for (let field of fields) {
						for (let index of indexes) {
							for (let ind of index.fields) {
								if (ind.attribute == field.name) {
									field.primaryKey = field.primaryKey || index.primary || index.origin == "pk"
									if (index.fields.length > 1 || index.origin == "c") {
										field.unique = index.name
									}
									else {
										field.unique = field.unique || index.unique
									}
								}
							}
						}
						if (field.primaryKey) {
							if (hasAi) {
								field.autoIncrement = true
							}
							if (field.type == "INTEGER") {
								field.allowNull = false
							}
						}
						if (field.type == "TINYINT(1)") {
							field.type = ["BOOLEAN", "TINYINT(1)"]
							if (field.defaultValue === 0) {
								field.defaultValue = [0, "false"]
							}
							if (field.defaultValue === 1) {
								field.defaultValue = [1, "true"]
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
								field.onUpdate = fk.on_update && fk.on_update.toUpperCase()
								field.onDelete = fk.on_delete && fk.on_delete.toUpperCase()
							}
						}

						field.autoIncrement = field.autoIncrement || false // not undefined
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

	_backupTmpTable(table) {
		let queryInterface = this.sequelize.getQueryInterface()
		let qg = this.sequelize.getQueryInterface().QueryGenerator
		let infoQuery = queryInterface.describeTable(table)
		let indexQuery = queryInterface.showIndex(table)
		let fkQuery = this.sequelize.query(qg.getForeignKeysQuery(table, 'public'))
		let aiQuery = this.sequelize.query(`SELECT 1 as name FROM sqlite_master WHERE type = 'table' AND name = ? AND sql LIKE '%AUTOINCREMENT%'`, { replacements: [table], raw:true, plain:true })

		let promises = [infoQuery, indexQuery, fkQuery, aiQuery]
		return Promise.all(promises).then((results) => {
			let fields = results[0]
			let indexes = results[1]
			let fks = results[2]
			let hasAi = results[3][0]

			let uniqueKeys = []

			for (let field_name in fields) {
				let field = fields[field_name]
				for (let index of indexes) {
					for (let ind of index.fields) {
						if (ind.attribute == field_name) {
							field.primaryKey = field.primaryKey || index.primary || index.origin == "pk"
							if (index.fields.length == 1) {
								field.unique = field.unique || index.unique
							}
						}
					}
				}
				if (field.primaryKey) {
					if (hasAi) {
						field.autoIncrement = true
					}
					if (field.type == "INTEGER") {
						field.allowNull = false
					}
				}
				for (let fk of fks) {
					if (field_name == fk.from) {
						if (fk.table.substr(0,1) == '"')
							fk.table = fk.table.substr(1, fk.table.length - 2)
						if (fk.to.substr(0,1) == '"')
							fk.to = fk.to.substr(1, fk.to.length - 2)
						field.references = {
							model: fk.table,
							key: fk.to
						}
						field.onUpdate = fk.on_update && fk.on_update.toUpperCase()
						field.onDelete = fk.on_delete && fk.on_delete.toUpperCase()
					}
				}
			}

			for (let index of indexes) {
				if (index.fields.length > 1) {
					let uniqueFields = []
					for (let ind of index.fields) {
						uniqueFields.push(ind.attribute)
					}
					uniqueKeys.push({fields: uniqueFields, name: index.name, origin: index.origin, type: "UNIQUE"})
				}
			}

			// keep uniqueKeys / fields
			let tableData = {
				attributes: fields,
				options: {uniqueKeys: uniqueKeys},
				done: null,
				rename: null
			}

			const quotedTableName = qg.quoteTable(table);
			const quotedBackupTableName = qg.quoteTable(table + '_materia_backup');

			tableData.done = () => {
				const attributeNames = Object.keys(tableData.attributes).map(attr => qg.quoteIdentifier(attr)).join(', ')

				let attributesNameImport
				if (tableData.rename) {
					attributesNameImport = Object.keys(tableData.attributes).map((attr) => {
						if (attr == tableData.rename.after)
							return qg.quoteIdentifier(tableData.rename.before) + ' AS ' + qg.quoteIdentifier(attr)
						else
							return qg.quoteIdentifier(attr)
					}).join(', ')
				} else {
					attributesNameImport = attributeNames
				}

				const attributesSql = qg.attributesToSQL(tableData.attributes)

				let subQueries = [
					()=>this.sequelize.transaction(t => {
						let transactionQueries = [
							`PRAGMA foreign_keys = 0;`,
							`PRAGMA defer_foreign_keys = 1;`,
							`DROP TABLE IF EXISTS ${quotedBackupTableName};`,
							`CREATE TEMPORARY TABLE ${quotedBackupTableName} AS SELECT * FROM ${quotedTableName};`,
							`DROP TABLE ${quotedTableName};`,
							qg.createTableQuery(table, attributesSql, tableData.options),
							`INSERT INTO ${quotedTableName} SELECT ${attributesNameImport} FROM ${quotedBackupTableName};`,
							`DROP TABLE ${quotedBackupTableName};`
						].map(query => {
							return ()=>this.sequelize.query(query, {raw: true, transaction: t})
						})
						let p = Promise.resolve()
						for (let query of transactionQueries) {
							p = p.then(() => {
								return query()
							})
						}
						return p
					})
				]

				for (let uniq of tableData.options.uniqueKeys) {
					if (uniq.origin == "c") {
						subQueries.push(()=>queryInterface.addIndex(table, uniq))
					}
				}

				let p = Promise.resolve()
				for (let query of subQueries) {
					p = p.then(() => {
						return query()
					})
				}
				return p
			}

			return Promise.resolve(tableData)
		})
	}

	addColumn(table, column_name, attributes):any {
		if (attributes.references && attributes.allowNull === false) {
			// Adding a not null reference: http://stackoverflow.com/questions/24524153/adding-not-null-column-to-sqlite-table-with-references/24524935#24524935
			let queries = []
			queries.push(this.sequelize.query('PRAGMA foreign_keys = 0;'))
			queries.push(super.addColumn(table, column_name, attributes))
			queries.push(this.sequelize.query('PRAGMA foreign_keys = 1;'))

			return queries.reduce((p, f) => p.then(f), Promise.resolve())
		}

		return super.addColumn(table, column_name, attributes)
	}

	changeColumn(table, column_name, attributes) {
		return this._backupTmpTable(table).then((tableData) => {
			for (let k in attributes) {
				tableData.attributes[column_name][k] = attributes[k]
			}

			tableData.attributes[column_name].type = this.sequelize.normalizeDataType(tableData.attributes[column_name].type)
			if (tableData.attributes[column_name].default === false) {
				delete tableData.attributes[column_name].defaultValue
			}
			return tableData.done()
		})
	}

	removeColumn(table, column_name):any {
		return this._backupTmpTable(table).then((tableData) => {
			delete tableData.attributes[column_name]
			return tableData.done()
		})
	}

	renameColumn(table, column_name, column_new_name):any {
		return this._backupTmpTable(table).then((tableData) => {
			tableData.attributes[column_new_name] = tableData.attributes[column_name]
			delete tableData.attributes[column_name]
			tableData.rename = {before: column_name, after: column_new_name}
			return tableData.done()
		})
	}

	addConstraint(table, constraint) {
		return this._backupTmpTable(table).then((tableData) => {

			if (constraint.type == "primary") {
				for (let field of constraint.fields) {
					tableData.attributes[field].primaryKey = true
				}
			} else if (constraint.type == "unique") {
				if (constraint.fields.length == 1) {
					tableData.attributes[constraint.fields[0]].unique = true
				} else {
					tableData.options.uniqueKeys.push({
						fields: constraint.fields,
						name: constraint.name,
						type: "UNIQUE",
						origin: "c"
					})
				}
			}

			return tableData.done()
		})
	}

	dropConstraint(table, constraint) {
		return this._backupTmpTable(table).then((tableData) => {

			let changed = false

			if (constraint.name) {
				let uniqGroupFields

				// drop custom index and keep group info
				tableData.options.uniqueKeys.forEach((uniq, j) => {
					if ( ! changed && uniq.indexName == constraint.name && uniq.origin == "c") {
						tableData.options.uniqueKeys.splice(j, 1)
						uniqGroupFields = uniq.fields.join(',')
						changed = true
					}
				})

				// drop same index created by unique or primary
				tableData.options.uniqueKeys.forEach((uniq, j) => {
					if ( ! changed && uniqGroupFields == uniq.fields.join(',') && uniq.origin != "c" ) {
						tableData.options.uniqueKeys.splice(j, 1)
						changed = true
					}
				})
			}
			else if (constraint.field) {

				if (constraint.type == "unique") {
					// drop field constraint from groups
					tableData.options.uniqueKeys.forEach((uniq, j) => {
						for (let i in uniq.fields) {
							let field = uniq.fields[i]
							if (field == constraint.field) {
								uniq.fields.splice(i, 1)
								changed = true
								break
							}
						}
						if (uniq.fields.length == 0) {
							tableData.options.uniqueKeys.splice(j, 1)
						}
					})
				}

				// drop constraint in field
				for (let field_name in tableData.attributes) {
					let field = tableData.attributes[field_name]
					if (constraint.type == "primary") {
						if (field.primaryKey || field.unique) {
							field.primaryKey = false
							field.unique = false
							changed = true
						}
					} else if (constraint.field == field_name) {
						if (constraint.type == "unique" && field.unique) {
							field.unique = false
							changed = true
						} else if (constraint.type == "references" && field.references) {
							delete field.references
							changed = true
						}
					}
				}
			}

			if ( ! changed)
				return Promise.resolve()
			return tableData.done()
		})
	}

	authenticate() {
		return this.sequelize.authenticate().then(() => {
			this.sequelize.query("PRAGMA foreign_keys = 1;", {raw: true})
		})
	}
}