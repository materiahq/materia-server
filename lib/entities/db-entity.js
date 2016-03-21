'use strict';
var Entity = require('./entity')

class DBEntity extends Entity {
	constructor(app, name) {
		super(app, name, {
			findAll: require('./queries/findAll'),
			findOne: require('./queries/findOne'),
			create: require('./queries/create'),
			update: require('./queries/update'),
			delete: require('./queries/delete'),
			custom: require('./queries/custom'),
			sql: require('./queries/sql')
		})

		this.type = 'db'

		this.currentDiff = []
		this.currentDiffUndo = []
	}

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

	updateField(name, field, options) {
		options = options || {}

		return new Promise((accept, reject) => {
			let fieldobj
			let oldfield = this.getField(name)

			if ( ! oldfield) {
				return reject(new Error('This field does not exist'))
			}

			let differ_done
			options.differ = (done) => {
				differ_done = done
			}

			super.updateField(name, field, options).then((_fieldobj) => {
				fieldobj = _fieldobj

				if (options.db == false) {
					accept(fieldobj)
					return
				}

				this.loadModel()
				this.loadRelationsInModel()
				this.refreshQueries()

				if (oldfield.name != fieldobj.name)
					return this.app.database.sequelize.getQueryInterface().renameColumn(
						this.model.tableName, oldfield.name,
						fieldobj.name
					)
				else
					return Promise.resolve()
			}).then(() => {
				return this.app.database.sequelize.getQueryInterface().changeColumn(
					this.model.tableName, fieldobj.name,
					this.app.database._translateField(field)
				)
			}).then(() => {
				differ_done()
				accept(fieldobj)
			}).catch((err) => {
				reject(err)
			})
		})
	}

	addFieldAt(field, at, options) {
		options = options || {}

		return new Promise((accept, reject) => {
			let fieldobj

			super.addFieldAt(field, at, options).then((_fieldobj) => {
				fieldobj = _fieldobj

				if (options.db == false)
					return accept(fieldobj)

				this.loadModel()
				this.loadRelationsInModel()
				this.refreshQueries()

				if (field.required && ! field.default) {
					field.default = true
					return this.app.database.sequelize.getQueryInterface().addColumn(
						this.model.tableName, field.name,
						this.app.database._translateField(field)
					).then(() => {
						field.default = false
						delete field.defaultValue
						return this.app.database.sequelize.getQueryInterface().changeColumn(
							this.model.tableName, field.name,
							this.app.database._translateField(field)
						)
					})
				} else {
					return this.app.database.sequelize.getQueryInterface().addColumn(
						this.model.tableName, field.name,
						this.app.database._translateField(field)
					)
				}
			}).then(() => {
				accept(fieldobj)
			}).catch((err) => {
				reject(err)
			})
		})
	}

	removeField(field, options) {
		options = options || {}

		return super.removeField(field, options).then(() => {
			if (options.db == false)
				return Promise.resolve()

			this.loadModel()
			this.loadRelationsInModel()
			this.refreshQueries()

			return this.app.database.sequelize.getQueryInterface().removeColumn(this.model.tableName, field)
		})
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
		return json
	}
}

module.exports = DBEntity
