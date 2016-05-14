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
				let column_names = index.column_names.substr(1, index.column_names.length - 2).split(',')
				for (let ind of inds) {
					let name = column_names[index.column_indexes.indexOf(parseInt(ind))]
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
				return Promise.resolve(null)
			for (let index of fields[field]) {
				if (index.unique) {
					return Promise.resolve(index)
				}
			}
			return Promise.resolve(null)
		})
	}

	getUniqueIndices(field) {
		return this.getIndices().then((fields) => {
			if ( ! fields[field])
				return Promise.resolve([])
			let indices = []
			for (let index of fields[field]) {
				if (index.unique) {
					indices.push(index)
				}
			}
			return Promise.resolve(indices)
		})
	}

	updatePrimary(field, fieldobj) {
		let queryInterface = this.app.database.sequelize.getQueryInterface()
		let pks = this.getPK()
		let p

		// remove PK constraint
		if (pks.length) {
			p = this.getUniqueIndex(pks[0].name).then((index) => {
				if ( ! index) {
					return
				}
				// console.log('remove unique: ', field, index)
				return this.app.database.sequelize.query(
					'ALTER TABLE ' + this.name + ' DROP CONSTRAINT IF EXISTS ' + index.name
				).then(() => {
					return queryInterface.removeIndex(
						this.name, index.name
					)
				})
			})
		}
		else {
			p = Promise.resolve()
		}

		// add or remove field in PK
		if (field.primary) {
			if ( ! pks.find((x) => { return x.name == fieldobj.name })) {
				pks.push(fieldobj)
			}
			if (field.unique) {
				delete field.unique
			}
		} else {
			pks = pks.filter((x) => {
				return x.name != fieldobj.name
			})
			if (field.unique == undefined) {
				field.unique = true
			}
			if (field.unique == false) {
				delete field.unique
			}
		}

		// reconstruct PK constraint
		if (pks.length) {
			p = p.then(() => {
				let constraint_name = this.name + '_pkey'
				let pks_names = pks.map((x) => { return x.name })
				return this.app.database.sequelize.query(
					'ALTER TABLE ' + this.name + ' ADD CONSTRAINT ' + constraint_name + ' PRIMARY KEY (' + pks_names.join(', ') + ')'
				)
			})
		}
		return p
	}

	updateUnique(field, fieldobj) {
		let queryInterface = this.app.database.sequelize.getQueryInterface()

		return this.getUniqueIndices(fieldobj.name).then((indices) => {
			let constraint_name
			let uniqueFields = []
			let p = Promise.resolve()

			// remove field from unique constraints
			if (indices.length) {
				for (let index of indices) {
					;((index) => {
						p = p.then(() => {
							return this.app.database.sequelize.query(
								'ALTER TABLE ' + this.name + ' DROP CONSTRAINT IF EXISTS ' + index.name
							).then(() => {
								return queryInterface.removeIndex(
									this.name, index.name
								)
							})
						})

						let oldUniqueFields = this.getUniqueFields(index.name)
						oldUniqueFields = oldUniqueFields.filter((x) => { return x.name != fieldobj.name })
						let unique_names = oldUniqueFields.map((x) => { return x.name })
						if (oldUniqueFields.length) {
							p = p.then(() => {
								return this.app.database.sequelize.query(
									'ALTER TABLE ' + this.name + ' ADD CONSTRAINT ' + index.name + ' UNIQUE (' + unique_names.join(',') + ')'
								)
							})
						}
					})(index)
				}
			}

			if (typeof field.unique == 'string') {
				// remove unique constraint group
				uniqueFields = this.getUniqueFields(field.unique)
				constraint_name = field.unique
				p = p.then(() => {
					return this.app.database.sequelize.query(
						'ALTER TABLE ' + this.name + ' DROP CONSTRAINT IF EXISTS ' + constraint_name
					).then(() => {
						return queryInterface.removeIndex(
							this.name, constraint_name
						)
					})
				})
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
				let gen_name = unique_names.join('_') + '_' + this.name + '_key'
				p = p.then(() => {
					return this.app.database.sequelize.query(
						'ALTER TABLE ' + this.name + ' ADD CONSTRAINT ' + (constraint_name || gen_name) + ' UNIQUE (' + unique_names.join(',') + ')'
					).then(() => {
						//return queryInterface.addIndex(this.name, unique_names, {
						//	indexName: constraint_name || gen_name,
						//	indicesType: 'UNIQUE'
						//})
					})
				})
			}

			return p
		})
	}

	specialTypeCast(field, fieldobj, oldfield) {
		let queryCast
		let type = field.type

		if (field.type == "number") {
			type = "integer"
			if (oldfield.type == "text" || ! oldfield.type) {
				queryCast = "trim(" + fieldobj.name + ")::integer"
			}
			else if (oldfield.type == "date") {
				queryCast = "extract(epoch from " + fieldobj.name + ")::integer"
			}
		}
		else if (field.type == "float") {
			type = "double precision"
			if (oldfield.type == "text" || ! oldfield.type) {
				queryCast = "(trim(" + fieldobj.name + ")::double precision)"
			}
			else if (oldfield.type == "date") {
				queryCast = "(extract(epoch from " + fieldobj.name + ")::double precision)"
			}
		}
		else if (field.type == "boolean") {
			if (oldfield.type == "text" || ! oldfield.type) {
				queryCast = "CASE lower(" + fieldobj.name + ") WHEN 'false' THEN FALSE WHEN '0' THEN FALSE WHEN 'f' THEN FALSE WHEN 'n' THEN FALSE WHEN 'no' THEN FALSE ELSE TRUE END"
			} else if (oldfield.type == "number" || oldfield.type == "float") {
				queryCast = "CASE " + fieldobj.name + " WHEN 0 THEN FALSE ELSE TRUE END"
			}
		}
		else if (field.type == "date") {
			type = "timestamp with time zone"
			if (oldfield.type == "text" || ! oldfield.type) {
				queryCast = "to_timestamp(trim(" + fieldobj.name + ")::integer)"
			} else if (oldfield.type == "number" || oldfield.type == "float") {
				queryCast = "to_timestamp(" + fieldobj.name + ")"
			}
		}
		else if (field.type == "text") {
			if (oldfield.type == "date") {
				queryCast = "extract(epoch from " + fieldobj.name + ")"
			}
		}

		if (queryCast) {
			return this.app.database.sequelize.query(
				'ALTER TABLE "' + this.name + '" ALTER COLUMN "' + fieldobj.name + '" TYPE ' + type + ' USING ' + queryCast
			).then(() => {
				delete field.type
			})
		}
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
					return queryInterface.renameColumn(
						this.name, oldfield.name,
						fieldobj.name
					)
				}
			}).then(() => {
				if (field.primary != undefined) {
					return this.updatePrimary(field, fieldobj)
				}
			}).then(() => {
				if (field.unique != undefined && ! fieldobj.primary) {
					return this.updateUnique(field, fieldobj)
				}
			}).then(() => {
				delete field.unique
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
				return this.specialTypeCast(field, fieldobj, oldfield)
			}).then(() => {
				let dbfield = this.app.database._translateField(field)
				console.log('translate field', field.required, field, dbfield)
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
				dbfield = this.app.database._translateField(field)

				return this.app.database.sequelize.getQueryInterface().changeColumn(
					this.name, fieldobj.name, dbfield
				)
			}).then(() => {
				differ_done()

				if (options.apply != false) {
					this.loadModel()
					this.loadRelationsInModel()
					this.refreshQueries()
				}

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

				let p = Promise.resolve()
				if (field.required && ! field.default) {
					field.default = true
					if (field.generateFrom) {
						p = p.then(() => {
							let entityFrom = this.app.entities.get(field.generateFrom)
							let entityFromPk = entityFrom.getPK()[0]
							return entityFrom.getQuery('list').run().then((list) => {
								//console.log('from /', list, entityFromPk)
								if ( ! list.length) {
									field.required = false
									field.default = false
								}
								else {
									field.defaultValue = list[0][entityFromPk]
								}
							})
						})
					}
					p = p.then(() => {
						return this.app.database.sequelize.getQueryInterface().addColumn(
							this.name, field.name,
							this.app.database._translateField(field)
						)
					})
					if (field.required) {
						p = p.then(() => {
							field.default = false
							delete field.defaultValue
							delete field.isRelation
							return this.app.database.sequelize.getQueryInterface().changeColumn(
								this.name, field.name,
								this.app.database._translateField(field)
							)
						})
					}
				}
				else {
					p = p.then(() => {
						return this.app.database.sequelize.getQueryInterface().addColumn(
							this.name, field.name,
							this.app.database._translateField(field)
						)
					})
				}

				if (field.unique) {
					p = p.then(() => {
						return this.updateUnique(field, fieldobj)
					})
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

			let p = Promise.resolve()
			p = p.then(() => {
				let fieldobj = { name: field, unique: false }
				return this.updateUnique(fieldobj, fieldobj)
			})

			p = p.then(() => {
				return this.app.database.sequelize.getQueryInterface().removeColumn(this.name, field)
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
		this.model = this.app.database.define(this)
		if ( ! this.getField('id')) {
			this.model.removeAttribute('id')
		}
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
