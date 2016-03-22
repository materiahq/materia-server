'use strict'

class Versionning {
	constructor(app) {
		this.app = app
		this.DiffType = this.app.history.DiffType
	}

	_compareField(field1, field2) {
		//console.log('compare fields ', field1, field2)
		let props = ['name', 'type', 'primary', 'required', 'unique', 'autoIncrement', 'default', 'defaultValue']

		for (let k of props) {
			if (field1[k] != field2[k]) {
				return true
			}
		}

		//check fk

		return false
	}

	_diffEntity(entity, dbTable, diffs) {
		let dbFields = {}
		for (let _dbField of dbTable) {
			let dbField = this.app.database._fromdbField(_dbField)
			dbFields[dbField.name] = dbField
			//console.log('dbField', _dbField, dbField)
			let field = entity.getField(dbField.name)

			//console.log('test')
			if (field) {
				//check field attributes
				//console.log('check field', dbField)
				if ( this._compareField(dbField, field) ) {
					dbField.read = field.read
					dbField.write = field.write
					//console.log('change field', field, dbField, _dbField)
					diffs.push({
						redo: {
							type: this.DiffType.CHANGE_FIELD,
							table: entity.name,
							name: dbField.name,
							value: dbField
						},
						undo: {
							type: this.DiffType.CHANGE_FIELD,
							table: entity.name,
							name: field.name,
							value: field.toJson()
						}
					})
				}
			} else if ( dbField.name != 'updatedAt' && dbField.name != 'createdAt' ) {
				//console.log('table not found!')
				diffs.push({
					redo: {
						type: this.DiffType.ADD_FIELD,
						table: entity.name,
						value: dbField
					},
					undo: {
						type: this.DiffType.DELETE_FIELD,
						table: entity.name,
						value: dbField.name
					}
				})
			}
		}
		for (let field of entity.getFields()) {
			if ( ! dbFields[field.name]) {
				diffs.push({
					redo: {
						type: this.DiffType.DELETE_FIELD,
						table: entity.name,
						value: field.name
					},
					undo: {
						type: this.DiffType.ADD_FIELD,
						table: entity.name,
						value: field.toJson()
					}
				})
			}
		}
	}


	_diffEntities(entities, dbTables, diffs) {
		let tableCompared = []
		entities.forEach((entity) => {
			tableCompared[entity.name] = entity;
			if (dbTables[entity.name]) {
				//compare fields
				//console.log(entity.name)
				this._diffEntity(entity, dbTables[entity.name], diffs)
			}
			else {
				diffs.push({
					redo: {
						type: this.DiffType.DELETE_ENTITY,
						table: entity.name
					},
					undo: {
						type: this.DiffType.CREATE_ENTITY,
						table: entity.name,
						value: entity.toJson()
					}
				})
			}
		})

		for (let table in dbTables) {
			// console.log('# create entity', table, dbTables[table])
			if ( ! tableCompared[table]) {
				let fields = []
				for (let field of dbTables[table]) {
					if ( field.Field != 'updatedAt' && field.Field != 'createdAt' ) {
						fields.push(this.app.database._fromdbField(field))
					}
				}
				diffs.push({
					redo: {
						type: this.DiffType.CREATE_ENTITY,
						table: table,
						value: {
							name: table,
							fields: fields,
							queries: [],
							relations: []
						}
					},
					undo: {
						type: this.DiffType.DELETE_ENTITY,
						table: table
					}
				})
			}
		}
	}

	diff() {
		return this.app.database.showTables().then((dbTables) => {
			let diffs = []
			let entities = this.app.entities.findAll()

			this._diffEntities(entities, dbTables, diffs)

			return Promise.resolve(diffs)
		})
	}

	entitiesToDatabase() {
		return this.diff().then((diffs) => {
			//console.log('entitiesToDatabase', diffs)
			return this.app.history.revert(diffs, {history:false, apply:false})
		})
	}

	databaseToEntities() {
		return this.diff().then((diffs) => {
			return this.app.history.apply(diffs, {history:false, db:false})
		})
	}
}

module.exports = Versionning