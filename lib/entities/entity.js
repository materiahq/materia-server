'use strict';

var fs = require('fs')
var path = require('path')

var uuid = require('node-uuid')

var Field = require('./field')
var QueryGenerator = require('./query-generator')

class Entity {
	constructor(app, queryTypes) {
		this.app = app
		this.DiffType = app.history.DiffType

		this.relations_queue = []
		this.queryObjects = {}

		if (queryTypes) {
			this.defineQueryObjects(queryTypes)
		}
	}

	initDefaultQuery() {
		if (this.constructor.name == 'DBEntity') {
			let qg = new QueryGenerator(this);
			qg.generateQueries()
		}
	}

	create(entityobj, options) {
		options = options || {}

		this.name = entityobj.name
		this.id = entityobj.id || uuid.v4()
		this.fields = []
		this.relations = []
		this.queries = []
		this.isRelation = entityobj.isRelation

		let promises = []

		if (entityobj.fields) {
			entityobj.fields.forEach((field) => {
				promises.push(this.addField(field, {history:false, save:false, db:false}))
			})
		}

		if (entityobj.relations) {
			entityobj.relations.forEach((relation) => {
				if (options.wait_relations)
					this.relations_queue.push({relation:relation, options:{history:false, save:false, db:false}})
				else
					promises.push(this.addRelation(relation, {history:false, save:false, db:false}))
			})
		}

		return Promise.all(promises).then(() => {
			this.initDefaultQuery()
			if (entityobj.queries) {
				entityobj.queries.forEach((query) => {
					//fix: don't overload default query else it always overload after the first generation
					let reservedQueries = [
						'list', 'get', 'create', 'update', 'delete'
					]
					if (reservedQueries.indexOf(query.id) == -1) {
						this.addQuery(query.id, query.type, query.params, query.opts, {history:false, save:false})
					}
				})
			}
		});
	}

	applyRelations() {
		let promises = []
		for (let relobj of this.relations_queue) {
			if (this.app.entities.get(relobj.relation.reference.entity))
				promises.push(this.addRelation(relobj.relation, relobj.options))
		}
		this.relations_queue = []
		return Promise.all(promises).then(() => {
			return new Promise((accept, reject) => {
				this.refreshQueries()
				accept()
			})
		})
	}

	save(opts) {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		fs.writeFileSync(
			path.join(this.app.path, 'entities', this.name + '.json'),
			JSON.stringify(this.toJson(), null, '\t')
		)
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	getRelations() { return this.relations }

	getRelation(field) {
		for (let relation of this.relations) {
			if (field == relation.field)
				return relation
		}
		return null
	}

	getRelationIndex(relation) {
		for (let i in this.relations) {
			let rel = this.relations[i]
			if (relation.field && relation.field == rel.field)
				return i // type belongsTo
			else if (relation.as && relation.as == rel.as
					&& relation.reference.entity == rel.reference.entity
					&& relation.reference.as == rel.reference.as)
				return i // type belongsToMany
			else if (relation.reference.field
					&& relation.reference.entity == rel.reference.entity
					&& relation.reference.field == rel.reference.field)
				return i // type hasMany
		}
		return -1
	}

	addRelation(relation, options) {
		options = options || {}
		return new Promise((accept, reject) => {
			let entityDest = this.app.entities.get(relation.reference.entity)
			let p = Promise.resolve()
			if ( ! relation.type || relation.type == 'belongsTo') {
				if (options.apply != false)
					this.relations.push(relation)

				if ( ! entityDest)
					return accept() // when loading entities

				// console.log('addRelation', this.name, relation, entityDest && entityDest.name)

				let keyReference = entityDest.getPK()[0]
				if (relation.reference.field && relation.reference.field != keyReference.name) {
					let f = entityDest.getField(relation.reference.field)
					if ( ! f.unique) {
						return reject(f.name + ' cannot be a key (need unique/primary field)')
					}
					keyReference = f
				}
				p = this.addField({
					name: relation.field,
					type: keyReference.type,
					default: false,
					generateFrom: relation.reference.entity,
					required: true,
					read: true,
					write: true,
					primary: false,
					unique: false,
					isRelation: relation
				}, options)
			}
			else if (relation.type == 'hasMany') {
				if (options.apply != false) {
					this.relations.push(relation)
				}
			}
			else if (relation.type == 'belongsToMany') {
				if (options.apply != false) {
					this.relations.push(relation)

					if ( ! entityDest) {
						return accept() // when loading entities
					}

					let field1 = this.getPK()[0]
					let field2 = this.app.entities.get(relation.reference.entity).getPK()[0]

					if ( ! relation.as)
						relation.as = field1.name

					let isRelation = [{
							field: relation.as,
							entity: this.name
						}, {
							field: relation.reference.as,
							entity: relation.reference.entity
						}
					]

					let implicitRelation = [
						{
							type: 'belongsTo',
							reference: {
								entity: this.name,
								field: field1.name
							}
						},
						{
							type: 'belongsTo',
							reference: {
								entity: relation.reference.entity,
								field: field2.name
							}
						}
					]

					let throughEntity = this.app.entities.get(relation.through)
					if (throughEntity) {
						//console.log('reusing entity', throughEntity)

						let asField1 = throughEntity.getField(relation.as)
						let asField2 = throughEntity.getField(relation.reference.as)

						if (throughEntity.isRelation) {
							//console.log ('compare relations', throughEntity.isRelation, relation)
							if (throughEntity.compareIsRelation(relation, this))
								return reject(new Error('Table ' + relation.through + ' is already used for a different relation'))
							//console.log('already exists, ok', asField1, asField2)
							p = Promise.resolve()
							if ( ! asField1) {
								p = p.then(() => {
									return throughEntity.addField({
										name: relation.as,
										type: field1.type,
										default: false,
										generateFrom: this.name,
										required: true,
										read: true,
										write: true,
										primary: true,
										unique: true,
										isRelation: implicitRelation[0]
									}, options)
								})
							}
							if ( ! asField2) {
								p = p.then(() => {
									return throughEntity.addField({
										name: relation.reference.as,
										type: field2.type,
										default: false,
										generateFrom: relation.reference.entity,
										required: true,
										read: true,
										write: true,
										primary: true,
										unique: true,
										isRelation: implicitRelation[1]
									}, options)
								})
							}
						}
						else {
							if ( ! asField1 || ! asField2) {
								return reject(new Error('Cannot use existing table ' + relation.through + ' for a many to many relation'))
							}

							throughEntity.isRelation = isRelation

							if (asField1.isRelation)
								asField1.isRelation.implicit = true
							else {
								if (asField1.name == relation.as) {
									asField1.references = isRelation[1]
									asField1.isRelation = implicitRelation[0]
								}
								else {
									asField1.references = isRelation[0]
									asField1.isRelation = implicitRelation[1]
								}
								p = p.then(() => {
									return throughEntity.updateField(asField1.name, asField1, options)
								})
							}

							if (asField2.isRelation)
								asField2.isRelation.implicit = true
							else {
								if (asField2.name == relation.as) {
									asField2.references = isRelation[1]
									asField2.isRelation = implicitRelation[0]
								}
								else {
									asField2.references = isRelation[0]
									asField2.isRelation = implicitRelation[1]
								}
								p = p.then(() => {
									return throughEntity.updateField(asField2.name, asField2, options)
								})
							}
							p = p.then(() => {
								if (options.save) {
									throughEntity.save(options)
								}
							})
						}
					}
					else {
						p = this.app.entities.add({
							name: relation.through,
							overwritable: true,
							fields: [{
								name: relation.as,
								type: field1.type,
								default: false,
								required: true,
								read: true,
								write: true,
								primary: true,
								unique: true,
								isRelation: implicitRelation[0]
							}, {
								name: relation.reference.as,
								type: field2.type,
								default: false,
								required: true,
								read: true,
								write: true,
								primary: true,
								unique: true,
								isRelation: implicitRelation[1]
							}],
							isRelation: isRelation
						}, options)
					}
				}
			}
			else {
				reject()
			}

			if ( ! p)
				p = Promise.resolve()
			p.then(() => {
				if (options.history != false) {
					this.app.history.push({
						type: this.DiffType.ADD_RELATION,
						table: this.name,
						value: relation
					},{
						type: this.DiffType.DELETE_RELATION,
						table: this.name,
						value: relation
					})
				}

				if (options.apply != false) {
					this.initDefaultQuery()
				}

				if (options.save != false) {
					this.save()
				}

				accept()
			}, (err) => {
				reject(err)
			})
		})
	}

	removeRelation(relation, options) {
		options = options || {}

		let i = this.getRelationIndex(relation)
		if (i == -1 && options.apply != false)
			return Promise.reject(new Error('Could not find relation'))

		let p = Promise.resolve()
		if (options.apply != false) {
			relation = this.relations.splice(i, 1)[0]
			let inversedRelation = {
				field: relation.reference.field,
				entity: relation.reference.entity,
				reference: {
					field: relation.field,
					entity: this.name
				}
			}
			p = this.app.entities.get(relation.reference.entity).removeRelation(inversedRelation).catch(() => {
				return Promise.resolve()
			})
		}

		if (relation.type == 'belongsToMany') {
			let entityThrough = this.app.entities.get(relation.through)
			if (entityThrough && entityThrough.isRelation) {
				//console.log('DELETE RELATION', relation)

				let relationField = entityThrough.getField(relation.as)
				relationField.references = null
				relationField.isRelation = null
				p = p.then(() => {
					return entityThrough.updateField(relationField.name, relationField, options)
				}).then(() => {
					if ( ! relation.paired) {
						return this.app.entities.get(relation.reference.entity).removeRelation({
							type: 'belongsToMany',
							as: relation.reference.as,
							paired: true,
							reference: {
								entity: this.name,
								as: relation.as
							}
						}, options).catch((e) => {
							//console.log('did not found other belongsToMany', e.message)
							return Promise.resolve()
						}).then(() => {
							delete entityThrough.isRelation
							if (options.save != false) {
								entityThrough.save(options)
							}
						})
					}
				})
			}
			// this.app.entities.remove(relation.through)
		} else if (relation.type == 'belongsTo') {
			p = p.then(() => {
				return this.removeField(relation.field, options)
			})
		}

		return p.then(() => {
			this.initDefaultQuery()

			if (options.history != false) {
				this.app.history.push({
					type: this.DiffType.DELETE_RELATION,
					table: this.name,
					value: relation
				},{
					type: this.DiffType.ADD_RELATION,
					table: this.name,
					value: relation
				})
			}

			if (options.save != false) {
				this.save(options)
			}
		})
	}

	getField(name) {
		for (let field of this.fields) {
			if (field.name == name) {
				return field
			}
		}
	}

	getFields() { return this.fields }

	getWritableFields() {
		let res = []
		this.fields.forEach((field) => {
			if (field.write) {
				res.push(field)
			}
		})
		return res
	}

	getReadableFields() {
		let res = []
		this.fields.forEach((field) => {
			if (field.read) {
				res.push(field)
			}
		})
		return res
	}

	updateField(name, newfield, options) {
		return new Promise((accept, reject) => {
			options = options || {}

			if (! name) {
				return reject()
			}

			let fieldobj
			try {
				fieldobj = new Field(this, newfield)
			} catch(e) {
				return reject(e)
			}

			let done = () => {
				this.fields.forEach((field, k) => {
					if (field.name == name) {
						if (options.apply != false) {
							this.fields.splice(k, 1, fieldobj)
						}
						if (options.history != false) {
							this.app.history.push({
								type: this.DiffType.CHANGE_FIELD,
								table: this.name,
								name: field.name,
								value: fieldobj.toJson()
							},{
								type: this.DiffType.CHANGE_FIELD,
								table: this.name,
								name: fieldobj.name,
								value: field.toJson()
							})
						}
					}
				})

				if (options.save != false)
					this.save(options)

				this.initDefaultQuery()
			}

			if (options.differ) {
				options.differ(done)
			} else {
				done()
			}

			accept(fieldobj)
		})
	}

	addFieldAt(field, at, options) {
		return new Promise((accept, reject) => {
			options = options || {}

			let fieldobj
			try {
				fieldobj = new Field(this, field)
			} catch(e) {
				return reject(e)
			}

			if (options.apply != false) {
				if (this.getField(field.name)) {
					if (field.isRelation)
						return accept() // skip
					return reject(new Error('A field of this name already exists'))
				}
				this.fields.splice(at, 0, fieldobj)
			}

			if (options.history != false && ! field.isRelation) {
				this.app.history.push({
					type: this.DiffType.ADD_FIELD,
					table: this.name,
					value: fieldobj.toJson(),
					position: at
				},{
					type: this.DiffType.DELETE_FIELD,
					table: this.name,
					value: field.name
				})
			}

			if (options.save != false) {
				this.save(options)
			}
			this.initDefaultQuery()
			return accept(fieldobj)
		})
	}

	addField(field, options) {
		return this.addFieldAt(field, this.fields.length, options)
	}

	addFieldFirst(field, options) {
		return this.addFieldAt(field, 0, options)
	}

	removeField(name, options) {
		return new Promise((accept, reject) => {
			options = options || {}
			if (! name) {
				return reject()
			}
			if (options.apply != false && ! this.getField(name)) {
				return reject(new Error('This field does not exist'))
			}
			this.fields.forEach((field, k) => {
				if (field.name == name) {
					if (options.apply != false) {
						this.fields.splice(k, 1)
					}
					if (options.history != false) {
						this.app.history.push({
							type: this.DiffType.DELETE_FIELD,
							table: this.name,
							value: field.name
						},{
							type: this.DiffType.ADD_FIELD,
							table: this.name,
							value: field.toJson(),
							position: k
						})
					}
				}
			})

			if (options.save != false)
				this.save(options)

			this.initDefaultQuery()
			accept()
		})
	}

	toJson() {
		let fieldsJson = []
		if (this.fields) {
			for (let field of this.fields) {
				if ( ! field.isRelation) {
					fieldsJson.push(field.toJson())
				}
			}
		}

		let relJson = []
		if (this.relations) {
			for (let relation of this.relations) {
				if ( ! relation.implicit) {
					relJson.push(relation)
				}
			}
		}

		let queriesJson = []
		if (this.queries) {
			for (let query of this.queries) {
				if (['get', 'list', 'update', 'create', 'delete'].indexOf(query.id) == -1)
					queriesJson.push(query.toJson())
			}
		}

		let res = {
			id: this.id
		}

		if (fieldsJson.length) {
			res.fields = fieldsJson
		}

		if (this.isRelation) {
			res.isRelation = this.isRelation
		}

		if (relJson.length) {
			res.relations = relJson
		}

		if (queriesJson.length) {
			res.queries = queriesJson
		}

		return res
	}

	addDefaultQuery(id, type, params, opts) {
		return this.addQuery(id, type, params, opts, {history:false, save:false})
	}

	addQuery(id, type, params, opts, options) {
		options = options || {}

		if ( ! this.queryObjects[type]) {
			throw new Error('Query type `' + type + '` not defined')
		}

		let QueryClass = this.queryObjects[type]
		let queryobj = new QueryClass(this, id, params, opts)

		if (options.apply != false) {
			//check that query with `id` = id does not exist. if it exists, remove the query
			for (let i in this.queries) {
				let query = this.queries[i]
				if (query.id == id) {
					this.queries.splice(i, 1)
				}
			}

			this.queries.push(queryobj)
		}

		if (options.history != false) {
			this.app.history.push({
				type: this.DiffType.ADD_QUERY,
				table: this.name,
				id: id,
				value: queryobj.toJson()
			},{
				type: this.DiffType.DELETE_QUERY,
				table: this.name,
				id: id
			})
		}

		if (options.save != false) {
			this.save(options)
		}
	}

	removeQuery(id, options) {
		options = options || {}

		let queryobj = this.getQuery(id)

		if ( ! queryobj) {
			throw new Error('Could node find query `' + id + '`')
		}

		if (options.apply != false) {
			for (let i in this.queries) {
				let query = this.queries[i]
				if (query.id == id) {
					this.queries.splice(i, 1)
				}
			}
		}

		if (options.history != false) {
			this.app.history.push({
				type: this.DiffType.DELETE_QUERY,
				table: this.name,
				id: id
			},{
				type: this.DiffType.ADD_QUERY,
				table: this.name,
				id: id,
				value: queryobj.toJson()
			})
		}

		if (options.save != false) {
			this.save(options)
		}
	}

	getQuery(id) {
		for (let query of this.queries) {
			if (query.id == id) {
				return query
			}
		}
		return {
			run: () => {
				return Promise.reject('Query "' + id + '" not found in entity "' + this.name + '"')
			}
		}
	}

	refreshQueries() {
		for (let query of this.queries) {
			query.refresh()
		}
	}

	getQueries() { return this.queries }

	compareIsRelation(relation, entity) {
		if ( ! this.isRelation)
			return true
		if (this.isRelation[0].field == relation.as) {
			if (this.isRelation[0].entity == entity.name
				&& this.isRelation[1].field == relation.reference.as
				&& this.isRelation[1].entity == relation.reference.entity)
				return false
		} else if (this.isRelation[1].field == relation.as) {
			if (this.isRelation[1].entity == entity.name
				&& this.isRelation[0].field == relation.reference.as
				&& this.isRelation[0].entity == relation.reference.entity)
				return false
		}

		return true
	}

	defineQueryObjects(data) {
		this.queryObjects = data
	}

	getQueryTypes() {
		return Object.keys(this.queryObjects)
	}
}

module.exports = Entity
