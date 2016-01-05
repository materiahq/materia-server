'use strict';
var Entity = require('./abstract/entity')

class DBEntity extends Entity {
	constructor(app, name) {
		super(app, name, {
			findAll: require('./db/query/findAll'),
			findOne: require('./db/query/findOne'),
			create: require('./db/query/create'),
			update: require('./db/query/update'),
			delete: require('./db/query/delete'),
			custom: require('./db/query/custom'),
			sql: require('./db/query/sql')
		})

		this.type = 'db'

		this.currentDiff = []
		this.currentDiffUndo = []

		//console.log('queryObjects', this.queryObjects)

		//this.initPK()
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

	getFK(entity) {
		for (let relation of this.relations) {
			if (relation.reference.entity == entity) {
				return relation
			}
		}
	}

	addFieldAt(field, at, options) {
		options = options || {}

		return new Promise((accept, reject) => {
			var fieldobj

			super.addFieldAt(field, at, options).then((_fieldobj) => {
				fieldobj = _fieldobj

				if (options.db == false)
					return accept(fieldobj)

				this.loadModel()
				this.loadRelationsInModel()
				this.refreshQueries()

				return this.app.database.sequelize.getQueryInterface().addColumn(
					this.model.tableName, field.name,
					this.app.database._translateField(field)
				)
			}).then(() => {
				accept(fieldobj)
			}).catch((err) => {
				reject(err)
			})
		})
	}

	removeField(field, options) {
		options = options || {}

		super.removeField(field)

		if (options.db == false)
			return Promise.resolve()

		this.loadModel()
		this.loadRelationsInModel()
		this.refreshQueries()

		return this.app.database.sequelize.getQueryInterface().removeColumn(this.model.tableName, field)
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
		for (let relation of this.relations) {
			//console.log('loading relation', this.name, '->', relation)
			let entityDest = this.app.entities.get(relation.reference.entity)
			if ( ! entityDest)
				continue
			//@model.hasMany entityDest.model, relation.dstField if relation.type == '1-n' and relation.cardinality == '1'
			if ( ! relation.type || relation.type == 'belongsTo') {
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

				//console.log('type belongsTo')
				//console.log(this.name, '.belongsTo(', entityDest.name, ',foreignKey:', relation.field, ',targetKey:', key)
				//console.log(entityDest.name, '.hasMany(', this.name, ',foreignKey:', relation.field, ',targetKey:', key)

				this.model.belongsTo(entityDest.model, { foreignKey: relation.field, targetKey: key })
				entityDest.model.hasMany(this.model, { foreignKey: relation.field, targetKey: key })
			}
			else if (relation.type == 'hasMany') {
				let key = this.getPK().name
				if ( relation.field ) {
					key = relation.field
				}

				//console.log('type hasMany')
				//console.log(entityDest.name, '.belongsTo(', this.name, ',foreignKey:', relation.reference.field, ',targetKey:', key)
				//console.log(this.name, '.hasMany(', entityDest.name, ',foreignKey:', relation.reference.field, ',targetKey:', key)

				entityDest.model.belongsTo(this.model, { foreignKey: relation.reference.field, targetKey: key })
				this.model.hasMany(entityDest.model, { foreignKey: relation.reference.field, targetKey: key })
			}
		}
	}

	toJson() {
		let json = super.toJson()
		//json.type = 'db' //default type ?
		return json
	}
}

module.exports = DBEntity
