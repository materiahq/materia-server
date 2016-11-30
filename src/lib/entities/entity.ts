import * as fs from 'fs'
import * as path from 'path'

import App from '../app'

import * as uuid from 'node-uuid'

import { Field } from './field'

import { IAddon } from '../addons'

import { QueryGenerator } from './query-generator'

import { IQueryConstructor } from './query'

const MigrationType = require('../history').MigrationType


export interface IEntityConfig {
	id: string
	fields?: Array<Field>
	relations?: Array<any>
	queries?: Array<any>
	isRelation?: any
}

/**
 * @class Entity
 * @classdesc
 * An entity, in a database this correspond to a table.
 */
export class Entity {
	relations_queue: Array<any>
	queryObjects: any

	id: string
	name: string

	isRelation: any

	fields: Array<Field>
	relations: Array<any>
	queries: Array<any>

	fromAddon: IAddon

	constructor(public app: App, queryTypes) {
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

	fixIsRelation(options):Promise<void> {
		if ( ! this.isRelation)
			return Promise.resolve()
		let entity1 = this.app.entities.get(this.isRelation[0].entity)
		let entity2 = this.app.entities.get(this.isRelation[1].entity)

		let p = Promise.resolve()
		if ( ! entity1 || ! entity2) { // converts to / keep belongsTo relations
			let pk1 = entity1 && entity1.getPK()[0]
			if (pk1) {
				let rel = {
					type: 'belongsTo',
					field: this.isRelation[0].field,
					reference: {
						entity: entity1.name,
						field: pk1.name
					}
				}
				if (entity1.getRelationIndex(rel) == -1) {
					p = p.then(() => this.addRelation(rel, options))
				}
			}
			let pk2 = entity2 && entity2.getPK()[0]
			if (pk2) {
				let rel = {
					type: 'belongsTo',
					field: this.isRelation[1].field,
					reference: {
						entity: entity2.name,
						field: pk2.name
					}
				}
				if (entity2.getRelationIndex(rel) == -1) {
					p = p.then(() => this.addRelation(rel, options))
				}
			}
			delete this.isRelation
		} else { // add missing belongsToMany relations in related entities
			let rel1 = {
				type: 'belongsToMany',
				through: this.name,
				as: this.isRelation[0].field,
				reference: {
					entity: entity2.name,
					as: this.isRelation[1].field
				}
			}
			if (entity1.getRelationIndex(rel1) == -1) {
				p = p.then(() => entity1.addRelation(rel1, options))
			}

			let rel2 = {
				type: 'belongsToMany',
				through: this.name,
				as: this.isRelation[1].field,
				reference: {
					entity: entity1.name,
					as: this.isRelation[0].field
				}
			}
			if (entity2.getRelationIndex(rel2) == -1) {
				p = p.then(() => entity2.addRelation(rel2, options))
			}
		}
		return p
	}

	create(entityobj, options) {
		options = options || {}

		this.name = entityobj.name
		this.id = entityobj.id || uuid.v4()
		this.fields = []
		this.relations = []
		this.queries = []
		this.isRelation = entityobj.isRelation
		this.fromAddon = options.fromAddon

		let promises = []

		if (entityobj.fields) {
			entityobj.fields.forEach((field) => {
				promises.push(this.addField(field, {history:false, save:false, db:false, generateQueries: false}))
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

		return Promise.all(promises)
	}

	loadQueries(queries) {
		this.initDefaultQuery()
		if (queries) {
			queries.forEach((query) => {
				//fix: don't overload default query else it always overload after the first generation
				let reservedQueries = [
					'list', 'get', 'create', 'update', 'delete'
				]
				if (reservedQueries.indexOf(query.id) == -1) {
					try {
						this.addQuery(query.id, query.type, query.params, query.opts, {history:false, save:false})
					} catch(e) {
						if (e.originalError) {
							this.app.logger.warn('Skipped query ' + query.id + ' of entity ' + this.name)
							this.app.logger.warn('due to error: ' + e.originalError.stack)
						}
						else {
							throw e
						}
					}
				}
			})
		}
	}

	applyRelations() {
		let promises = []
		for (let relobj of this.relations_queue) {
			if (this.app.entities.get(relobj.relation.reference.entity)) {
				promises.push(this.addRelation(relobj.relation, relobj.options).catch((e) => {
					this.app.logger.warn(`In ${this.name}: ${e && e.message}. Skipped relation`)
					return Promise.resolve()
				}))
			}
		}
		this.relations_queue = []
		return Promise.all(promises).then(() => {
			this.refreshQueries()
		})
	}

	save(opts?) {
		let relativePath = path.join('server', 'models', this.name + '.json')
		let basepath = this.fromAddon ? this.fromAddon.path : this.app.path

		if (opts && opts.beforeSave) {
			opts.beforeSave(path.join(basepath, relativePath))
		}
		fs.writeFileSync(
			path.join(basepath, relativePath),
			JSON.stringify(this.toJson(), null, '\t')
		)
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}

	/**
	Returns a list of the relations
	@returns {Array<Relation>}
	*/
	getRelations() { return this.relations }

	/**
	 Returns all asociated entities
	 @returns {Array<Relation>}
	 */
	getRelatedEntities() {
		let associatedEntity = {}
		let entities = this.app.entities.entities
		for (let name in entities) {
			let entity = entities[name]
			for (let entityRelation of entity.relations) {
				if (entityRelation.reference.entity == this.name) {
					associatedEntity[name] = entity
				}
			}
		}
		//To find associatedTable from belongsToMany relation
		for (let relation of this.relations) {
			if (relation.reference && relation.reference.entity) {
				associatedEntity[relation.reference.entity] = entities[relation.reference.entity]
			}
		}

		// Object.values()
		let associatedEntityArray = []
		for (let k in associatedEntity) {
			associatedEntityArray.push(associatedEntity[k])
		}
		return associatedEntityArray
	}

	/**
	Returns a relation determined by a field
	@param {string} - Entity's field name
	@returns {Relation}
	*/
	getRelation(field) {
		for (let relation of this.relations) {
			if (field == relation.field)
				return relation
		}
		return null
	}

	/**
	Determines if a relation exists
	@param {Relation} - Relation to find in the relations array.
	@returns {integer} Index of the relation in the relations array, or -1 if non existant.
	*/
	getRelationIndex(relation):number {
		let res = -1
		this.relations.forEach((rel, i) => {
			if (res != -1) {
				return false
			}

			if (relation.field && relation.field == rel.field) {
				res = i // type belongsTo
			}
			else if (relation.as && relation.as == rel.as
					&& relation.reference.entity == rel.reference.entity
					&& relation.reference.as == rel.reference.as) {
				res = i // type belongsToMany
			}
			else if (relation.reference.field
					&& relation.reference.entity == rel.reference.entity
					&& relation.reference.field == rel.reference.field) {
				res = i // type hasMany
			}
		})
		return res
	}

	getPK(): Array<Field> {
		let pks = []
		for (let field of this.fields) {
			if (field.primary) {
				pks.push(field)
			}
		}
		return pks
	}

	/**
	Add a relation to the entity
	@param {Relation} - Relation's description.
	@param {object} - Action's options
	@returns {Promise}
	*/
	addRelation(relation, options) {
		options = options || {}
		return new Promise((accept, reject) => {
			if (relation.field && relation.reference.entity == relation.field) {
				return reject(new Error('The reference field cannot have the same name that its referenced entity'))
			}

			let entityDest = this.app.entities.get(relation.reference.entity)
			let p = Promise.resolve()
			if ( ! relation.type || relation.type == 'belongsTo') {
				relation.type = 'belongsTo'

				if ( ! entityDest) {
					if (options.apply != false)
						this.relations.push(relation)
					return accept() // when loading entities
				}

				// console.log('addRelation', this.name, relation, entityDest && entityDest.name)

				let keyReference = entityDest.getPK()[0]
				if (relation.reference.field && relation.reference.field != keyReference.name) {
					let f = entityDest.getField(relation.reference.field)
					if ( ! f) {
						return reject(new Error(`The relation's referenced field ${entityDest.name}.${relation.reference.field} does not exist`))
					}
					if ( ! f.unique) {
						return reject(new Error(`${entityDest.name}.${f.name} cannot be referenced in relation (need to be unique/primary)`))
					}
					keyReference = f
				}
				if (options.apply != false)
					this.relations.push(relation)

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

					//TODO: Should be all PK of this and relation.reference.entity
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
						type: MigrationType.ADD_RELATION,
						table: this.name,
						value: relation
					},{
						type: MigrationType.DELETE_RELATION,
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
			let paired = relation.paired
			relation = this.relations.splice(i, 1)[0]

			if ( ! paired) {
				let inverseType
				if (relation.type == 'belongsTo' || ! relation.type)
					inverseType = 'hasMany'
				else
					inverseType = relation.type // only n-n for now
				let inversedRelation = {
					type: inverseType,
					field: relation.reference.field,
					as: relation.reference.as,
					entity: relation.reference.entity,
					paired: true,
					reference: {
						field: relation.field,
						as: relation.as,
						entity: this.name
					}
				}
				p = this.app.entities.get(relation.reference.entity).removeRelation(inversedRelation, options).catch((e) => {
					if (e.message != "Could not find relation") {
						throw e
					}
				})
			}
		}

		if (relation.type == 'belongsToMany') {
			let entityThrough = this.app.entities.get(relation.through)
			if (entityThrough) {
				p = p.then(() => {
					let opts = {} as any
					for (let k in options) {
						opts[k] = options[k]
					}
					opts.history = false
					return this.app.entities.remove(relation.through, opts)
				})
			}
		} else if (relation.type == 'belongsTo' || ! relation.type) {
			p = p.then(() => {
				return this.removeField(relation.field, options)
			})
		}

		return p.then(() => {
			this.initDefaultQuery()

			if (options.history != false) {
				this.app.history.push({
					type: MigrationType.DELETE_RELATION,
					table: this.name,
					value: relation
				},{
					type: MigrationType.ADD_RELATION,
					table: this.name,
					value: relation
				})
			}

			if (options.save != false) {
				this.save(options)
			}
		})
	}

	/**
	Get a field description by its name.
	@param {string} - Field's name.
	@returns {Field}
	*/
	getField(name) {
		for (let field of this.fields) {
			if (field.name == name) {
				return field
			}
		}
	}

	/**
	Return true if field exist
	@param {string} - Field's name
	@returns {Boolean}
	*/
	isField(name) {
		return !! this.getField(name)
	}

	/**
	Get the entity's fields.
	@returns {Array<Field>}
	*/
	getFields() { return this.fields }

	/**
	Get the entity's writable fields.
	@returns {Array<Field>}
	*/
	getWritableFields() {
		let res = []
		this.fields.forEach((field) => {
			if (field.write) {
				res.push(field)
			}
		})
		return res
	}

	/**
	Get the entity's unique fields.
	@param {string|boolean} - unique group name, or true for independent uniques fields, or false for non unique fields.
	@returns {Array<Field>}
	*/
	getUniqueFields(group) {
		let res = []
		this.fields.forEach((field) => {
			if (field.unique == group) {
				res.push(field)
			}
		})
		return res
	}

	/**
	Get the entity's readable fields.
	@returns {Array<Field>}
	*/
	getReadableFields() {
		let res = []
		this.fields.forEach((field) => {
			if (field.read) {
				res.push(field)
			}
		})
		return res
	}

	/**
	Update a field.
	@param {string} - Field's name to update
	@param {object} - New field description
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
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
				if (options.apply != false && fieldobj.name != name) {
					for (let relation of this.relations) {
						if (relation.field == name) {
							relation.field = fieldobj.name
						}
					}
				}
				this.fields.forEach((field, k) => {
					if (field.name == name) {
						if (options.apply != false) {
							this.fields.splice(k, 1, fieldobj)
						}
						if (options.history != false) {
							this.app.history.push({
								type: MigrationType.CHANGE_FIELD,
								table: this.name,
								name: field.name,
								value: fieldobj.toJson()
							}, {
								type: MigrationType.CHANGE_FIELD,
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

	/**
	Add a new field.
	@param {object} - New field description
	@param {integer} - Field position in list
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
	addFieldAt(field, at, options) {
		options = options || {}

		let fieldobj
		try {
			fieldobj = new Field(this, field)
		} catch(e) {
			return Promise.reject(e)
		}

		if (options.apply != false) {
			if (this.getField(field.name)) {
				if (field.isRelation)
					return Promise.resolve() // skip
				return Promise.reject(new Error('A field of this name already exists'))
			}
			this.fields.splice(at, 0, fieldobj)
		}

		if (options.history != false && ! field.isRelation) {
			this.app.history.push({
				type: MigrationType.ADD_FIELD,
				table: this.name,
				value: fieldobj.toJson(),
				position: at
			},{
				type: MigrationType.DELETE_FIELD,
				table: this.name,
				value: field.name
			})
		}

		if (options.save != false) {
			this.save(options)
		}

		if (options.generateQueries !== false) { //!== because null default true
			this.initDefaultQuery()
		}

		return Promise.resolve(fieldobj)
	}

	/**
	Add a new field. Shortcut for addFieldAt(field, *fields count*, options)
	@param {object} - New field description
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
	addField(field, options) {
		return this.addFieldAt(field, this.fields.length, options)
	}

	/**
	Add a new field. Shortcut for addFieldAt(field, 0, options)
	@param {object} - New field description
	@param {object} - Action's options
	@returns {Promise<Field>}
	*/
	addFieldFirst(field, options) {
		return this.addFieldAt(field, 0, options)
	}

	/**
	Delete a field
	@param {string} - Field's name
	@param {object} - Action's options
	@returns {Promise}
	*/
	removeField(name, options):Promise<void> {
		options = options || {}
		if (! name) {
			return Promise.reject(new Error('The name of the field is required'))
		}
		if (options.apply != false && ! this.getField(name)) {
			return Promise.reject(new Error('This field does not exist'))
		}
		this.fields.forEach((field, k) => {
			if (field.name == name) {
				if (options.apply != false) {
					this.fields.splice(k, 1)
				}
				if (options.history != false) {
					this.app.history.push({
						type: MigrationType.DELETE_FIELD,
						table: this.name,
						value: field.name
					},{
						type: MigrationType.ADD_FIELD,
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
		return Promise.resolve()
	}

	/**
	Return the entity's description
	@returns {object}
	*/
	toJson() {
		let fieldsJson = []
		if (this.fields) {
			for (let field of this.fields) {
				if ( ! field.isRelation || ! field.isDefaultRelationField()) {
					fieldsJson.push(field.toJson())
				}
			}
		}

		let relJson = []
		if (this.relations) {
			this.relations.forEach(relation => {
				if ( ! relation.implicit) {
					let relCopy = {} as any
					for (let k in relation) {
						if (k != "entity") {
							relCopy[k] = relation[k]
						}
						if ( ! relCopy.type) {
							relCopy.type = 'belongsTo'
						}
					}
					relJson.push(relCopy)
				}
			})
		}

		let queriesJson = []
		if (this.queries) {
			this.queries.forEach(query => {
				if (['get', 'list', 'update', 'create', 'delete'].indexOf(query.id) == -1) {
					queriesJson.push(query.toJson())
				}
			})
		}

		let res: IEntityConfig = {
			id: this.id,
			fields: [],
			relations: [],
			queries: []
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

	addDefaultQuery(id:string, type:string, params, opts) {
		return this.addQuery(id, type, params, opts, {history:false, save:false})
	}

	/**
	Add a query to the entity
	@param {string} - Query's name
	@param {string} - Query's type. can be `findAll`, `findOne`, `create`, `update`, `delete`, `custom` or `sql`
	@param {Array<object>} - Query's parameters (input)
	@param {object} - Query's options
	@param {object} - Action's options
	*/
	addQuery(id:string, type:string, params, opts, options) {
		options = options || {}

		if ( ! this.queryObjects[type]) {
			throw new Error('Query type `' + type + '` not defined')
		}

		//To migrate from to November release (remove params OR moved to opts if SQL / Custom queries)
		if (params && (type == 'sql' || type == 'custom')) {
			opts.params = params
		}

		let QueryClass = this.queryObjects[type]
		let queryobj = <IQueryConstructor> new QueryClass(this, id, opts)

		if (options.apply != false) {
			//check that query with `id` = id does not exist. if it exists, remove the query
			let index = this.queries.indexOf(this.queries.find(query => query.id == id))
			if (index != -1) {
				this.queries.splice(index, 1)
			}

			this.queries.push(queryobj)
		}

		if (options.history != false) {
			this.app.history.push({
				type: MigrationType.ADD_QUERY,
				table: this.name,
				id: id,
				value: queryobj.toJson()
			}, {
				type: MigrationType.DELETE_QUERY,
				table: this.name,
				id: id
			})
		}

		if (options.save != false) {
			this.save(options)
		}
	}

	getNewQuery(id:string, type: string, opts):IQueryConstructor {
		if ( ! this.queryObjects[type]) {
			throw new Error('Query type `' + type + '` not defined')
		}

		let QueryClass = this.queryObjects[type]
		let queryobj = <IQueryConstructor> new QueryClass(this, id, opts)

		return queryobj
	}

	/**
	Delete a query
	@param {string} - Query's name
	@param {object} - Action's options
	*/
	removeQuery(id:string, options) {
		options = options || {}

		let queryobj = this.getQuery(id)

		if ( ! queryobj) {
			throw new Error('Could node find query `' + id + '`')
		}

		if (options.apply != false) {
			let index = this.queries.indexOf(this.queries.find(query => query.id == id))
			if (index != -1) {
				this.queries.splice(index, 1)
			}
		}

		if (options.history != false) {
			this.app.history.push({
				type: MigrationType.DELETE_QUERY,
				table: this.name,
				id: id
			},{
				type: MigrationType.ADD_QUERY,
				table: this.name,
				id: id,
				value: queryobj.toJson()
			})
		}

		if (options.save != false) {
			this.save(options)
		}
	}

	/**
	Get a query object
	@param {string} - Query's name
	@returns {Query}
	*/
	getQuery(id) {
		for (let query of this.queries) {
			if (query.id == id) {
				return query
			}
		}
		return {
			error: true,
			run: () => {
				return Promise.reject('Query "' + id + '" not found in entity "' + this.name + '"')
			}
		}
	}

	refreshQueries() {
		for (let query of this.queries) {
			query.refresh()
			query.discoverParams()
		}
	}

	/**
	Get the entity's queries
	@returns {Array<Query>}
	*/
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