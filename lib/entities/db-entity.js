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
		let fields = []
		for (let field of this.fields) {
			if (field.primary) {
				fields.push(field)
			}
		}
		if ( ! fields.length)
			console.error('warn: entity ' + this.name + ' does not contains a primary key')
		return fields
	}

	getFK(entity) {
		for (let relation of this.relations) {
			if (relation.reference.entity == entity) {
				return relation
			}
		}
	}

	getFKs() {
		let query = this.app.database.sequelize.getQueryInterface().QueryGenerator.getForeignKeysQuery(this.name, 'public')
		return this.app.database.sequelize.query(query).then((res) => {
			let fields = {}
			for (let fk of res) {
				fields[fk.from] = fk
			}
			return Promise.resolve(fields)
		})
	}

	getIndices() {
		let query = this.app.database.sequelize.getQueryInterface().QueryGenerator.showIndexesQuery(this.name)
		return this.app.database.sequelize.query(query).then((res) => {
			let fields = {}
			for (let index of res[0]) {
				let inds = index.indkey.split(' ');
				for (let ind of inds) {
					let column_names = index.column_names.substr(1, index.column_names.length - 2).split(',')
					let name = column_names[index.column_indexes.indexOf(parseInt(index.indkey))]
					fields[name] = fields[name] || []
					fields[name].push(index)
				}
			}
			return Promise.resolve(fields)
		})
	}

	getUniqueIndex(field) {
		return this.getIndices().then((fields) => {
			if ( ! fields[field])
				return Promise.reject(new Error("Could not find index"))
			for (let index of fields[field]) {
				if (index.unique) {
					return Promise.resolve(index)
				}
			}
			return Promise.reject(new Error("Could not find index"))
		})
	}

	updateField(name, field, options) {
		//console.log('updateField dbentity', field.unique)
		options = options || {}

		let oldfield = this.getField(name)
		if ( ! oldfield) {
			return reject(new Error('This field does not exist'))
		}

		return new Promise((accept, reject) => {
			let fieldobj

			let differ_done
			options.differ = (done) => {
				differ_done = done
			}

			let queryInterface
			if (options.db != false)
				queryInterface = this.app.database.sequelize.getQueryInterface()

			// complete with old values
			let _field = {}
			for (let k in oldfield) {
				_field[k] = oldfield[k]
			}
			for (let k in _field) {
				_field[k] = _field[k]
			}
			super.updateField(name, _field, options).then((_fieldobj) => {
				fieldobj = _fieldobj
				if (options.db == false) {
					throw null
				}

				if (options.apply != false) {
					this.loadModel()
					this.loadRelationsInModel()
					this.refreshQueries()
				}

				//oldfield = oldfield.toJson()

				//oldfield.fillDefault()
				//console.log('oldfield', JSON.stringify(oldfield.toJson()), oldfield)

				//console.log('update field', oldfield.require, field.require, field)

				if (options.apply != false) {
					if (field.type == oldfield.type)
						delete field.type
					if (field.unique == oldfield.unique)
						delete field.unique
					if (field.required == oldfield.required)
						delete field.required
					if (field.primary == oldfield.primary)
						delete field.primary
				}

				//console.log('after diff', field.unique)

				if (oldfield.name != fieldobj.name) {
					return queryInterface.renameColumn(
						this.name, oldfield.name,
						fieldobj.name
					)
				}
			}).then(() => {
				//if (field.unique == true) {
					//console.log('add unique: ', field.unique)
					//return queryInterface.addIndex(
					//	this.name, [field.name], {
					//		indexName: field.name + '_color_key',
					//		indicesType: 'UNIQUE'
					//	}
					//)
				//}
				//else
				if (field.unique == false) {
					return this.getUniqueIndex(fieldobj.name).then((index) => {
						// console.log('remove unique: ', field, index)
						return this.app.database.sequelize.query(
							'ALTER TABLE ' + this.name + ' DROP CONSTRAINT ' + index.name
						).then(() => {
							return queryInterface.removeIndex(
								this.name, index.name
							)
						})
					})
				}
			}).then(() => {
				if (field.references === null) {
					return this.getFKs().then((fks) => {
						if (fks[fieldobj.name]) {
							//console.log("remove FK -->", fks, this.name)
							return this.app.database.sequelize.query(
								'ALTER TABLE ' + this.name + ' DROP CONSTRAINT ' + fks[fieldobj.name].constraint_name
							)/*.then(() => {
								return queryInterface.removeIndex(
									this.name, fks[fieldobj.name].id
								)
							})*/
						}
					})
				}
			}).then(() => {
				if (field.unique == false)
					delete field.unique
				let dbfield = this.app.database._translateField(field)
				console.log('translate field', field.required, field, dbfield)
				if (Object.keys(dbfield).length == 0)
					return Promise.resolve()
				if ( ! dbfield.type) {
					// sequelize changeColumn must constain type
					field.type = oldfield.type
					dbfield = this.app.database._translateField(field)
				}
				return this.app.database.sequelize.getQueryInterface().changeColumn(
					this.name, fieldobj.name, dbfield
				)
			}).then(() => {
				differ_done()
				accept(fieldobj)
			}).catch((err) => {
				if (err == null && options.db == false)
					return accept(fieldobj)
				console.error('error while updateField', err.stack)
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

				if (options.apply != false) {
					this.loadModel()
					this.loadRelationsInModel()
					this.refreshQueries()
				}

				if (field.required && ! field.default) {
					field.default = true
					return this.app.database.sequelize.getQueryInterface().addColumn(
						this.name, field.name,
						this.app.database._translateField(field)
					).then(() => {
						field.default = false
						delete field.defaultValue
						delete field.isRelation
						return this.app.database.sequelize.getQueryInterface().changeColumn(
							this.name, field.name,
							this.app.database._translateField(field)
						)
					})
				} else {
					return this.app.database.sequelize.getQueryInterface().addColumn(
						this.name, field.name,
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

			if (options.apply != false) {
				this.loadModel()
				this.loadRelationsInModel()
				this.refreshQueries()
			}

			return this.app.database.sequelize.getQueryInterface().removeColumn(this.name, field)
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
				let key = entityDest.getPK()[0].name
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
				let key = this.getPK()[0].name
				if ( relation.field ) {
					key = relation.field
				}

				//console.log('type hasMany')
				//console.log(entityDest.name, '.belongsTo(', this.name, ',foreignKey:', relation.reference.field, ',targetKey:', key)
				//console.log(this.name, '.hasMany(', entityDest.name, ',foreignKey:', relation.reference.field, ',targetKey:', key)

				entityDest.model.belongsTo(this.model, { foreignKey: relation.reference.field, targetKey: key })
				this.model.hasMany(entityDest.model, { foreignKey: relation.reference.field, targetKey: key })
			}
			else if (relation.type == 'belongsToMany') {
				let entityThrough = this.app.entities.get(relation.through)
				if ( ! entityThrough) {
					console.log('through not found')
					continue
				}
				this.model.belongsToMany(entityDest.model, {
					through: {
						model: entityThrough.model
					},
					foreignKey: relation.reference.as,
					otherKey: relation.as
				})
			}
		}
	}

	toJson() {
		let json = super.toJson()
		return json
	}
}

module.exports = DBEntity
