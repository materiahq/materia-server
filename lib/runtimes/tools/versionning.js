'use strict'

class Versionning {
	constructor(app) {
		this.app = app
		this.DiffType = this.app.history.DiffType
	}

	_compareField(dbfield, field, entity) {
		let props = ['name', 'type', 'primary', 'required', 'autoIncrement', 'default', 'defaultValue']

		let diff = [{},{}]
		let found = false
		for (let k of props) {
			if (Array.isArray(dbfield[k])) {
				if (dbfield[k].indexOf(field[k]) == -1) {
					diff[0][k] = dbfield[k][0]
					diff[1][k] = field[k]
					found = true
				}
			} else if (dbfield[k] != field[k]) {
				diff[0][k] = dbfield[k]
				diff[1][k] = field[k]
				found = true
			}
		}

		if (dbfield.unique != field.unique && ! dbfield.primary && ! field.primary
			&& ! (dbfield.unique == true && (typeof field.unique == 'string') && entity.getUniqueFields(field.unique).length == 1)) {
			diff[0].unique = dbfield.unique
			diff[1].unique = field.unique
			found = true
		}

		if ( ! found)
			return false
		return diff
	}

	_compareRelation(rel1, rel2) {
		return rel1.entity != rel2.entity || rel2.field != rel2.field
	}

	_diffRelation(entity, dbField, field, diffs) {
		if (dbField.fk) {
			if (dbField.unique && entity.isRelation)
				return true
			let relations = entity.getRelations()
			let found = false
			for (let relation of relations) {
				if (relation.field != dbField.name)
					continue
				found = true
				if (this._compareRelation(relation.reference, dbField.fk)) {
					// delete and create relation field.fk
					diffs.relations.push({
						redo: {
							type: this.DiffType.DELETE_RELATION,
							table: entity.name,
							value: relation,
						},
						undo: {
							type: this.DiffType.ADD_RELATION,
							table: entity.name,
							value: relation
						}
					})
					diffs.relations.push({
						redo: {
							type: this.DiffType.ADD_RELATION,
							table: entity.name,
							value: {
								field: dbField.name,
								reference: dbField.fk
							},
						},
						undo: {
							type: this.DiffType.DELETE_RELATION,
							table: entity.name,
							value: {
								field: dbField.name,
								reference: dbField.fk
							}
						}
					})
				}
			}
			if ( ! found) {
				diffs.relations.push({
					redo: {
						type: this.DiffType.ADD_RELATION,
						table: entity.name,
						value: {
							field: dbField.name,
							reference: dbField.fk
						},
					},
					undo: {
						type: this.DiffType.DELETE_RELATION,
						table: entity.name,
						value: {
							field: dbField.name,
							reference: dbField.fk
						}
					}
				})
			}
			return true
		} else if (field) {
			// if a field is a relation and a simple field in db
			if (field.isRelation) {
				diffs.relations.push({
					redo: {
						type: this.DiffType.DELETE_RELATION,
						table: entity.name,
						value: field.isRelation
					},
					undo: {
						type: this.DiffType.ADD_RELATION,
						table: entity.name,
						value: field.isRelation
					}
				})
				diffs.fields.push({
					redo: {
						type: this.DiffType.ADD_FIELD,
						table: entity.name,
						value: field
					},
					undo: {
						type: this.DiffType.DELETE_FIELD,
						table: entity.name,
						value: field.name
					}
				})
				return true
			}
		}
		return false
	}

	_diffEntity(entity, dbTable, diffs) {
		let dbFields = {}
		let isRelationTable = []
		for (let _dbField of dbTable) {
			if ( _dbField.fk && _dbField.unique) {
				isRelationTable.push({
					as: _dbField.name,
					entity: _dbField.fk.entity
				})
			}
		}

		if (isRelationTable.length == 2 && ( ! entity.isRelation || entity.getFields().length < 2)) {
			// add relations belongsToMany
			diffs.relations.push({
				redo: {
					type: this.DiffType.ADD_RELATION,
					table: isRelationTable[0].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[0].as,
						reference: isRelationTable[1]
					}
				},
				undo: {
					type: this.DiffType.DELETE_RELATION,
					table: isRelationTable[0].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[0].as,
						reference: isRelationTable[1]
					}
				}
			})
			diffs.relations.push({
				redo: {
					type: this.DiffType.ADD_RELATION,
					table: isRelationTable[1].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[1].as,
						reference: isRelationTable[0]
					}
				},
				undo: {
					type: this.DiffType.DELETE_RELATION,
					table: isRelationTable[1].entity,
					value: {
						type: 'belongsToMany',
						through: entity.name,
						as: isRelationTable[1].as,
						reference: isRelationTable[0]
					}
				}
			})
		}

		for (let _dbField of dbTable) {
			let dbField = this.app.database.interface.columnToField(_dbField)
			dbField.fk = _dbField.fk
			dbFields[dbField.name] = dbField
			let field = entity.getField(dbField.name)

			//console.log('isRelationTable', entity.name, isRelationTable)
			if (isRelationTable.length != 2 && this._diffRelation(entity, dbField, field, diffs))
				continue

			if (field) {//} && ! dbField.fk) {
				let fieldDiff = this._compareField(dbField, field, entity)
				if ( fieldDiff ) {
					// update field to db properties
					dbField.read = field.read
					dbField.write = field.write
					diffs.fields.push({
						redo: {
							type: this.DiffType.CHANGE_FIELD,
							table: entity.name,
							name: dbField.name,
							value: fieldDiff[0]
						},
						undo: {
							type: this.DiffType.CHANGE_FIELD,
							table: entity.name,
							name: field.name,
							value: fieldDiff[1]
						}
					})
				}
			} else if ( ! dbField.fk && dbField.name != 'updatedAt' && dbField.name != 'createdAt' ) {
				// add field that are in db
				diffs.fields.push({
					redo: {
						type: this.DiffType.ADD_FIELD,
						table: entity.name,
						value: this.app.database.interface.flattenField(dbField)
					},
					undo: {
						type: this.DiffType.DELETE_FIELD,
						table: entity.name,
						value: dbField.name
					}
				})
			}
		}

		// delete fields that are not in db
		for (let field of entity.getFields()) {
			if ( ! dbFields[field.name] && ! field.isRelation) {
				diffs.fields.push({
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

		// delete relations that are not in db
		//console.log('------relations------', entity.getRelations())
		for (let relation of entity.getRelations()) {
			//console.log ('relation', relation, dbFields[relation.field])
			if ( ! dbFields[relation.field] && relation.type == 'belongsTo' && ! relation.implicit) {
				// delete relation
				diffs.relations.push({
					redo: {
						type: this.DiffType.DELETE_RELATION,
						table: entity.name,
						value: relation,
					},
					undo: {
						type: this.DiffType.ADD_RELATION,
						table: entity.name,
						value: relation
					}
				})
			}
		}
	}


	_diffEntities(entities, dbTables, diffs) {
		let tableCompared = []
		for (let entity of entities) {
			tableCompared[entity.name] = entity;
			if (dbTables[entity.name]) {
				//compare fields
				//console.log(entity.name, entity)
				this._diffEntity(entity, dbTables[entity.name], diffs)
			}
			else if (entity.isRelation) {
				let relation = {
					type: "belongsToMany",
					through: entity.name,
					as: entity.isRelation[0].as,
					reference: {
						entity: entity.isRelation[1].entity,
						as: entity.isRelation[1].as
					}
				}
				diffs.relations.push({
					redo: {
						type: this.DiffType.DELETE_RELATION,
						table: entity.isRelation[0].entity,
						value: relation
					},
					undo: {
						type: this.DiffType.ADD_RELATION,
						table: entity.isRelation[0].entity,
						value: relation
					}
				})

				relation = {
					type: "belongsToMany",
					through: entity.name,
					as: entity.isRelation[1].as,
					reference: {
						entity: entity.isRelation[0].entity,
						as: entity.isRelation[0].as
					}
				}
				diffs.relations.push({
					redo: {
						type: this.DiffType.DELETE_RELATION,
						table: entity.isRelation[1].entity,
						value: relation
					},
					undo: {
						type: this.DiffType.ADD_RELATION,
						table: entity.isRelation[1].entity,
						value: relation
					}
				})
			} else {
				diffs.entities.push({
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
		}

		for (let table in dbTables) {
			// console.log('# create entity', table, dbTables[table])
			// if table exists in db but not in entities
			if ( ! tableCompared[table]) {
				let fields = []
				let relations = []
				let isRelation = []
				let createdAt = false
				let updatedAt = false
				for (let field of dbTables[table]) {
					if ( field.fk ) {
						relations.push({
							field: field.name,
							reference: field.fk
						})
						if (field.unique) {
							isRelation.push({
								field: field.name,
								entity: field.fk.entity
							})
						}
					} else if ( field.name != 'updatedAt' && field.name != 'createdAt' ) {
						fields.push(this.app.database.interface.columnToField(field))
					} else if ( field.name == 'updatedAt') {
						updatedAt = true
					} else if ( field.name == 'createdAt') {
						createdAt = true
					}
				}

				if (isRelation.length != 2)
					isRelation = undefined
				else {
					relations = undefined
					let relation = {
						type: "belongsToMany",
						through: table,
						as: isRelation[0].field,
						reference: {
							entity: isRelation[1].entity,
							as: isRelation[1].field
						}
					}
					diffs.relations.push({
						redo: {
							type: this.DiffType.ADD_RELATION,
							table: isRelation[0].entity,
							value: relation
						}, undo: {
							type: this.DiffType.DELETE_RELATION,
							table: isRelation[0].entity,
							value: relation
						}
					})

					relation = {
						type: "belongsToMany",
						through: table,
						as: isRelation[1].field,
						reference: {
							entity: isRelation[0].entity,
							as: isRelation[0].field
						}
					}
					diffs.relations.push({
						redo: {
							type: this.DiffType.ADD_RELATION,
							table: isRelation[1].entity,
							value: relation
						}, undo: {
							type: this.DiffType.DELETE_RELATION,
							table: isRelation[1].entity,
							value: relation
						}
					})
				}

				let tableDesc = {
					name: table,
					fields: fields,
					queries: [],
					isRelation: isRelation,
					relations: relations
				}
				if ( ! createdAt) {
					tableDesc.createdAt = false
				}
				if ( ! updatedAt) {
					tableDesc.updatedAt = false
				}
				diffs.entities.push({
					redo: {
						type: this.DiffType.CREATE_ENTITY,
						table: table,
						value: tableDesc
					},
					undo: {
						type: this.DiffType.DELETE_ENTITY,
						table: table
					}
				})
			}
		}
	}

	_diffMap(entities, dbTables) {
		let diffs = {
			entities: [],
			fields: [],
			relations: []
		}

		this._diffEntities(entities, dbTables, diffs)

		diffs.length = diffs.entities.length + diffs.fields.length + diffs.relations.length
		return diffs
	}

	diff() {
		return this.app.database.interface.showTables().then((dbTables) => {
			let entities = this.app.entities.findAll()

			let diffs = this._diffMap(entities, dbTables)
			return Promise.resolve(diffs)
		})
	}

	entitiesToDatabase(diffs, options) {
		let opts = {}
		if (options) {
			for (let k in options) {
				opts[k] = options[k]
			}
		}
		options = opts
		options.history = false
		options.apply = false
		options.save = false

		let actions = []
		for (let type of ['relations', 'fields', 'entities']) {
			for (let action of diffs[type]) {
				actions.push(action)
			}
		}
		return this.app.history.revert(actions, options)
	}

	databaseToEntities(diffs, options) {
		let opts = {}
		if (options) {
			for (let k in options) {
				opts[k] = options[k]
			}
		}
		options = opts
		options.history = false
		options.db = false

		let actions = []
		for (let type of ['entities', 'fields', 'relations']) {
			for (let action of diffs[type]) {
				actions.push(action)
			}
		}

		return this.app.history.apply(actions, options)
	}
}

module.exports = Versionning