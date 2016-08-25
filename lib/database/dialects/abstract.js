'use strict'

class AbstractDialect {
	constructor(sequelize) {
		this.sequelize = sequelize
	}

	showTables() {
		return Promise.reject(new Error('Not implemented method in dialect'))
	}

	getIndices(table) {
		return this.sequelize.getQueryInterface().showIndex(table).then((res) => {
			let fields = {}
			for (let index of res) {
				for (let field of index.fields) {
					fields[field.attribute] = fields[field.attribute] || []
					fields[field.attribute].push(index)
				}
			}
			return Promise.resolve(fields)
		})
	}

	getFKs(table) {
		let query = this.sequelize.getQueryInterface().QueryGenerator.getForeignKeysQuery(table, 'public')
		return this.sequelize.query(query).then((res) => {
			let fields = {}
			for (let fk of res) {
				fields[fk.from] = fk
			}
			return Promise.resolve(fields)
		})
	}

	addColumn(table, column_name, attributes) {
		return this.sequelize.getQueryInterface().addColumn(
			table, column_name, attributes
		)
	}

	changeColumn(table, column_name, attributes) {
		return this.sequelize.getQueryInterface().changeColumn(
			table, column_name, attributes
		)
	}

	removeColumn(table, column_name) {
		return this.sequelize.getQueryInterface().removeColumn(table, column_name)
	}

	renameColumn(table, column_name, column_new_name) {
		return this.sequelize.getQueryInterface().renameColumn(table, column_name, column_new_name)
	}

	dropConstraint(table, constraint) {
		return Promise.reject(new Error('Not implemented method in dialect'))
	}

	addConstraint(table, constraint) {
		return Promise.reject(new Error('Not implemented method in dialect'))
	}

	castColumnType(table, column_name, old_type, type) {
		return Promise.resolve(false)
	}
}

module.exports = AbstractDialect