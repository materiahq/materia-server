'use strict';
var Entity = require('./entity')

class DBEntity extends Entity {
	constructor(app) {
		super(app, {
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
		let pks = []
		for (let field of this.fields) {
			if (field.primary) {
				pks.push(field)
			}
		}
		return pks
	}

	updatePrimary(field, fieldobj, options) {
		let pks = this.getPK()
		let p = Promise.resolve()

		let restore_ai = false

		// For mysql, it needs to remove auto increment before dropping pk
		if (this.app.database.type == 'mysql') {
			for (let pk of pks) {
				if (pk.autoIncrement) {
					let pkcpy = {}
					for (let k in pk) {
						pkcpy[k] = pk[k]
					}
					pkcpy.autoIncrement = false
					restore_ai = pk.name
					p = this.updateField(pk.name, pkcpy, options)
				}
			}
		}

		// remove PK constraint
		if (pks.length) {
			let pk_name = pks[0].name
			p = p.then(() => {
				return this.app.database.interface.dropConstraint(this.name, {field: pk_name, type:"primary"})
			})
		}

		// add or remove field in PK
		if (field.primary) {
			if ( ! pks.find(x => x.name == fieldobj.name)) {
				pks.push(fieldobj)
			}
			if (field.unique) {
				delete field.unique
			}
		} else {
			pks = pks.filter(x => x.name != fieldobj.name)
			if (field.unique == undefined) {
				field.unique = true
			}
			if (field.unique == false) {
				delete field.unique
			}
		}

		// reconstruct PK constraint
		if (pks.length) {
			let pks_names = pks.map(x => x.name)
			p = p.then(() => {
				return this.app.database.interface.addConstraint(this.name, {fields: pks_names, type: "primary"})
			})
		}

		// restore auto increment for mysql, if it's still in pk
		if (this.app.database.type == 'mysql' && restore_ai) {
			if (pks.find(x => x.name == restore_ai)) {
				p = p.then(() => {
					let pk = this.getField(restore_ai)
					let pkcpy = {}
					for (let k in pk) {
						pkcpy[k] = pk[k]
					}
					pkcpy.autoIncrement = true
					p = this.updateField(pk.name, pkcpy, options)
				})
			} else {
				if (restore_ai == fieldobj.name) {
					p = p.then(() => {
						fieldobj.autoIncrement = false
					})
				}
			}
		}

		delete field.primary
		return p
	}

	updateUnique(field, fieldobj) {
		let constraint_name
		let uniqueFields = []
		let p

		// remove field from unique constraints
		p = this.app.database.interface.dropConstraint(this.name, {field: fieldobj.name, type: "unique"})

		if (typeof field.unique == 'string') {
			// remove unique constraint group
			uniqueFields = this.getUniqueFields(field.unique)
			constraint_name = field.unique
			p = p.then(() => {return this.app.database.interface.dropConstraint(this.name, {name: constraint_name, type: "unique"})})
		}

		// add or remove field in constraint
		if (field.unique) {
			if ( ! uniqueFields.find((x) => { return x.name == fieldobj.name })) {
				uniqueFields.push(fieldobj)
			}
		} else {
			if (uniqueFields.length) {
				uniqueFields = uniqueFields.filter((x) => { return x.name != fieldobj.name })
			}
		}

		// reconstruct unique constraint
		if (uniqueFields.length) {
			//console.log('add unique: ', field.unique)
			let unique_names = uniqueFields.map((x) => { return x.name })
			p = p.then(() => {
				return this.app.database.interface.addConstraint(this.name, {fields: unique_names, name: constraint_name, type: "unique"})
			})
		}

		return p
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

			// complete with old values
			let _field = {}
			for (let k in oldfield) {
				_field[k] = oldfield[k]
			}
			for (let k in field) {
				_field[k] = field[k]
			}

			if (_field.autoIncrement && _field.type.toLowerCase() != "number") {
				delete _field.autoIncrement
				delete field.autoIncrement
			}

			super.updateField(name, _field, options).then((_fieldobj) => {
				fieldobj = _fieldobj
				if (options.db == false) {
					differ_done()
					throw null
				}

				//oldfield = oldfield.toJson()

				//oldfield.fillDefault()
				//console.log('oldfield', JSON.stringify(oldfield.toJson()), oldfield)

				//console.log('update field', JSON.stringify(oldfield.toJson()), JSON.stringify(field), JSON.stringify(fieldobj.toJson()))

				if (options.apply != false) {
					if (field.type == oldfield.type)
						delete field.type
					if (field.unique == oldfield.unique)
						delete field.unique
					if (field.required == oldfield.required)
						delete field.required
					if (field.primary == oldfield.primary)
						delete field.primary
					if (field.default == oldfield.default)
						delete field.default
					if (field.autoIncrement == oldfield.autoIncrement)
						delete field.autoIncrement
					if (field.defaultValue == oldfield.defaultValue)
						delete field.defaultValue
				}

				//console.log('after diff', field.unique)

				if (oldfield.name != fieldobj.name) {
					return this.app.database.interface.renameColumn(
						this.name, oldfield.name,
						fieldobj.name
					)
				}
			}).then(() => {
				if (field.primary != undefined) {
					return this.updatePrimary(field, fieldobj, options)
				}
			}).then(() => {
				if (field.unique != undefined && ! fieldobj.primary) {
					return this.updateUnique(field, fieldobj)
				}
			}).then(() => {
				delete field.unique
				if (field.references === null) {
					return this.app.database.interface.dropConstraint(this.name, {field: fieldobj.name, type: "references"})
				}
			}).then(() => {
				return this.app.database.interface.castColumnType(this.name, fieldobj.name, oldfield.type, field.type)
			}).then((castedType) => {
				if (castedType) {
					delete field.type
				}
				let dbfield = this.app.database.interface.fieldToColumn(field)
				//console.log('translate field', field.required, field, dbfield)
				if (Object.keys(dbfield).length == 0)
					return Promise.resolve()

				// sequelize changeColumn must constain type and nullable
				if ( ! dbfield.type) {
					field.type = oldfield.type
				}
				if ( dbfield.allowNull == undefined) {
					field.required = oldfield.required
				}
				if ( dbfield.default == undefined) {
					field.default = oldfield.default
				}
				if ( field.default && dbfield.defaultValue == undefined) {
					field.defaultValue = oldfield.defaultValue
				}

				let p = Promise.resolve()
				if ( field.required && ! field.default && field.defaultValue ) {
					p = p.then(() => {
						field.default = true
						field.required = false
						dbfield = this.app.database.interface.fieldToColumn(field)
						field.default = false
						field.required = true
						delete field.defaultValue

						let vals = {}
						let where = {}
						vals[fieldobj.name] = dbfield.defaultValue
						where[fieldobj.name] = null

						return this.model.update(vals, {where:where})
					})
				}
				return p.then(() => {
					return this.app.database.interface.changeColumn(this.name, fieldobj.name, field)
				})
			}).then(() => {
				differ_done()

				if (options.apply != false) {
					return this.loadModel().then(() => {
						this.loadRelationsInModel()
						this.refreshQueries()
					})
				}
			}).then(() => {
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

		if (field.autoIncrement && field.type.toLowerCase() != "number") {
			delete field.autoIncrement
		}

		return super.addFieldAt(field, at, options).then((fieldobj) => {

			if (options.db == false)
				return Promise.resolve(fieldobj)

			let p = Promise.resolve()
			if (options.apply != false) {
				p = this.loadModel().then(() => {
					this.loadRelationsInModel()
					this.refreshQueries()
				})
			}

			if (field.required && ! field.default) {
				field.default = true
				if (field.generateFrom) {
					p = p.then(() => {
						let entityFrom = this.app.entities.get(field.generateFrom)
						let entityFromPk = entityFrom.getPK()[0]
						return entityFrom.getQuery('list').run({limit: 1}).then((list) => {
							if ( ! list.rows.length) {
								field.required = false
								field.default = false
							}
							else {
								field.defaultValue = list.rows[0][entityFromPk.name]
							}
						})
					})
				}
				p = p.then(() => {
					return this.app.database.interface.addColumn(this.name, field.name, field)
				})
				if (field.required) {
					p = p.then(() => {
						field.default = false
						delete field.defaultValue
						delete field.isRelation
						return this.app.database.interface.changeColumn(this.name, field.name, field)
					})
				}
			}
			else {
				p = p.then(() => {
					return this.app.database.interface.addColumn(this.name, field.name, field)
				})
			}

			if (field.unique) {
				p = p.then(() => {
					return this.updateUnique(field, fieldobj)
				})
			}

			return p.then(() => {
				return fieldobj
			})
		})
	}

	removeField(field, options) {
		options = options || {}

		return super.removeField(field, options).then(() => {
			if (options.db == false)
				return Promise.resolve()

			let p = Promise.resolve()
			if (options.apply != false) {
				p = this.loadModel().then(() => {
					this.loadRelationsInModel()
					this.refreshQueries()
				})
			}

			p = p.then(() => {
				let fieldobj = { name: field, unique: false }
				return this.updateUnique(fieldobj, fieldobj)
			})

			p = p.then(() => {
				return this.app.database.interface.removeColumn(this.name, field)
			})

			return p
		})
	}

	generateDefaultQueries() {
		let QueryGenerator = require('./query-generator')
		let qg = new QueryGenerator(this)
		qg.generateQueries()
	}

	loadModel() {
		let idField = this.getField('id')
		let idPKforce = false
		if (idField && ! this.getPK().length) {
			idPKforce = true
			idField.primary = true
		}
		try {
			this.model = this.app.database.interface.define(this)
		} catch(e) {
			return Promise.reject(e)
		}
		if (idPKforce) {
			idField.primary = false
		}
		if ( ! this.getField('id')) {
			this.model.removeAttribute('id')
		}
		return Promise.resolve()
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
					console.error('Through table not found')
					continue
				}
				this.model.belongsToMany(entityDest.model, {
					through: {
						model: entityThrough.model
					},
					foreignKey: relation.as,
					otherKey: relation.reference.as
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
