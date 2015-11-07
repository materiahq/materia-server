'use strict';
var Entity = require('../abstract/entity')

class DBEntity extends Entity {
	constructor(app, name, fields, relations, queries) {
		super(app, name, fields, relations, queries, {
			findAll: require('./query/findAll'),
			findOne: require('./query/findOne'),
			create: require('./query/create'),
			update: require('./query/update'),
			delete: require('./query/delete'),
			custom: require('./query/custom')
			//sql: require('./query/sql')
		})

		this.type = 'db'
		this.DiffType = Object.freeze({
			CREATE_TABLE: 'create_table',
			RENAME_TABLE: 'rename_table',
			DROP_TABLE: 'delete_table',
			CREATE_TABLE: 'create_table',
			ADD_COLUMN: 'create_column',
			CHANGE_COLUMN: 'change_column',
			DELETE_COLUMN: 'delete_column',
			ADD_FK: 'add_foreign_key',
			DELETE_FK: 'delete_foreign_key'
		})

		this.currentDiff = []
		this.currentDiffUndo = []

		//console.log('queryObjects', this.queryObjects)

		//this.initPK()
	}

	registerCreateDiff() {
		this.currentDiff.push({
			type: this.DiffType.CREATE_TABLE,
			table: this.name,
			value: this.fields
		})
		this.currentDiffUndo.push({
			type: this.DiffType.DROP_TABLE,
			table: this.name
		})
	}

	rename(newName) {
		this.currentDiff.push({
			type: this.DiffType.RENAME_TABLE,
			table: this.name,
			value: newName
		})
		this.currentDiffUndo.push({
			type: this.DiffType.RENAME_TABLE,
			table: newName,
			value: this.name
		})
		super.rename(newName)
	}

	remove() {
		this.currentDiff.push({
			type: this.DiffType.DROP_TABLE,
			table: this.name
		})
		this.currentDiffUndo.push({
			type: this.DiffType.CREATE_TABLE,
			table: this.name,
			value: this.fields
		})
		super.remove()
	}



	/*initPK() {
		let find = false
		let id = null
		this.fields.forEach((field, k) => {
			if (field.primary) {
				find = true
			}
			if (field.name == 'id_' + this.name) {
				id = k
			}
		})

		if ( ! find) {
			if (id) {
				this.fields[id].primary = true
				this.fields[id].unique = true
				this.fields[id].write = false
				this.fields[id].read = true
				this.fields[id].default = false
				this.fields[id].autoIncrement = true
				this.fields[id].required = true
				this.save()
			}
			else {
				this.addField({
					name: 'id_' + this.name,
					type: 'number',
					autoIncrement: true,
					default: false,
					required: true,
					read: true,
					write: false,
					primary: true,
					unique: true
				}, false, true)
			}
		}
	}*/

	getPK() {
		for (let field of this.fields) {
			if (field.primary) {
				return field
			}
		}
	}

	generateDefaultQueries() {
		let QueryGenerator = require('./query-generator')
		let qg = new QueryGenerator(this)
		qg.generateQueries()
	}

	loadModel() {
		this.model = this.app.database.define(this)
	}

	loadRelationsInModel() {
		this.relations.forEach((relation) => {
			//console.log('loading relation', this.name, '->', relation)
			let entityDest = this.app.entities.get(relation.reference.entity)
			//@model.hasMany entityDest.model, relation.dstField if relation.type == '1-n' and relation.cardinality == '1'
			if (relation.type == 'belongsTo') {
/*				console.log(this.name + ' belongs to ' + entityDest.name + ' with fk: ' + relation.field)
				//entityDest.model.belongsTo @model, foreignKey: relation.dstField
				let keyReference = entityDest.getPK()
				if (relation.reference.field && relation.reference.field != keyReference.name) {
					let f = entityDest.getField(relation.reference.field)
					if ( ! f.unique) {
						throw f.name + ' cannot be a key (need unique/primary field)'
					}
					keyReference = f
				}*/
				let key = entityDest.getPK().name
				if ( relation.reference.field ) {
					key = relation.reference.field
				}

				this.model.belongsTo(entityDest.model, { foreignKey: relation.field, targetKey: key })
			}
			else if (relation.type == 'hasMany') {

			}
		})
	}

	toJson() {
		let json = super.toJson()
		json.type = 'db'
		return json
	}
}

module.exports = DBEntity
