'use strict';

var fs = require('fs')
var path = require('path')
var Field = require('./field')

var _ = require('lodash')
//var an = require('../../utils/an')
//var ucfirst = require('../../utils/ucfirst')

class Entity {
	constructor(app, name, queryTypes) {
		this.app = app
		this.DiffType = app.history.DiffType
		this.name = name

		this.fields = []
		this.relations = []
		this.queries = []

		this.relations_queue = []

		this.queryObjects = {}

		if (queryTypes) {
			this.defineQueryObjects(queryTypes)
		}
	}

	create(fields, relations, queries, options) {
		options = options || {}

		this.fields = []
		this.relations = []
		this.queries = []

		let promises = []

		if (fields) {
			fields.forEach((field) => {
				promises.push(this.addField(field, {history:false, save:false, db:false}))
			})
		}

		if (relations) {
			relations.forEach((relation) => {
				if (options.wait_relations)
					this.relations_queue.push({relation:relation, options:{history:false, save:false, db:false}})
				else
					promises.push(this.addRelation(relation, {history:false, save:false, db:false}))
			})
		}

		if (queries) {
			queries.forEach((query) => {
				this.addQuery(query.id, query.type, query.params, query.opts)
			})
		}

		return Promise.all(promises)
	}

	applyRelations() {
		let promises = []
		for (let relobj of this.relations_queue)
			promises.push(this.addRelation(relobj.relation, relobj.options))
		this.relations_queue = []
		return Promise.all(promises).then(() => {
			return new Promise((accept, reject) => {
				this.refreshQueries()
				accept()
			})
		})
	}

	save() {
		fs.writeFileSync(
			path.join(this.app.path, 'entities', this.name + '.json'),
			JSON.stringify(this.toJson(), null, 2)
		)
	}

	getRelations() { return this.relations }

	/*
		add a relation 1-n with `entity`
		it will create `opts.field` which make reference to `opts.fieldRef` from `entity`
	*/
	belongsTo(entity, opts) {
		if ( ! opts ) {
			opts = {}
		}
		if ( ! opts.field) {
			if ( ! opts.fieldRef) {
				opts.field = entity.name + '_' + entity.getPK().name
				opts.fieldRef = entity.getPK().name
			}
			else {
				opts.field = entity.name + '_' + opts.fieldRef
			}
		}
		else {
			if ( ! opts.fieldRef) {
				opts.fieldRef = entity.getPK().name
			}
		}
	}

	addRelation(relation, options) {
		return new Promise((accept, reject) => {
			let entityDest = this.app.entities.get(relation.reference.entity)
			if ( ! relation.type || relation.type == 'belongsTo') {
				this.relations.push(relation)

				//if ( ! entityDest)
				//	return accept() // moar test needed

				console.log('addRelation', this.name, relation, entityDest && entityDest.name)

				let keyReference = entityDest.getPK()
				if (relation.reference.field && relation.reference.field != keyReference.name) {
					let f = entityDest.getField(relation.reference.field)
					if ( ! f.unique) {
						return reject(f.name + ' cannot be a key (need unique/primary field)')
					}
					keyReference = f
				}
				this.addField({
					name: relation.field,
					type: keyReference.type,
					default: false,
					required: true,
					read: true,
					write: true,
					primary: false,
					unique: false,
					isRelation: true
				}, options).then(() => {
					accept()
				}, (err) => {
					reject(err)
				})
			}
			else if (relation.type == 'hasMany') {
				this.relations.push(relation)

				accept()

				//add query type for getAll...
			}
			else {
				reject()
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

	addFieldAt(field, at, options) {
		options = options || {}
		if ( ! field.name) {
			return null
		}
		field.edit = false
		let fieldobj = new Field(this, field)
		this.fields.splice(at, 0, fieldobj)

		if (options.history != false) {
			this.app.history.push({
				type: this.DiffType.ADD_FIELD,
				table: this.name,
				value: field,
				position: at
			},{
				type: this.DiffType.DELETE_FIELD,
				table: this.name,
				value: field.name
			})
		}

		if (options.save != false)
			this.save()

		return Promise.resolve(fieldobj)
	}

	addField(field, options) {
		return this.addFieldAt(field, this.fields.length, options)
	}

	addFieldFirst(field, options) {
		return this.addFieldAt(field, 0, options)
	}

	removeField(name, options) {
		options = options || {}
		if (! name) {
			return false
		}
		this.fields.forEach((field, k) => {
			if (field.name == name) {
				this.fields.splice(k, 1)
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
			this.save()
	}

	toJson() {
		let fieldsJson = []
		if (this.fields) {
			this.fields.forEach((field) => {
				if ( ! field.isRelation) {
					fieldsJson.push(field.toJson())
				}
			})
		}

		let queriesJson = []
		if (this.queries) {
			this.queries.forEach((query) => {
				queriesJson.push(query.toJson())
			})
		}

		return {
			name: this.name,
			fields: fieldsJson,
			relations: this.relations,
			queries: queriesJson
		}
	}

	addQuery(id, type, params, opts) {
		if ( ! this.queryObjects[type]) {
			//console.log('throw error', this.queryObjects, type)
			throw 'Query type `' + type + '` not defined'
		}

		let queryClass = this.queryObjects[type]
		//console.log(queryClass, type)
		this.queries.push(new queryClass(this, id, params, opts))
	}

	getQuery(id) {
		for (let query of this.queries) {
			if (query.id == id) {
				return query
			}
		}
	}

	refreshQueries() {
		for (let query of this.queries) {
			query.refresh()
		}
	}

	getQueries() { return this.queries }

	defineQueryObjects(data) {
		this.queryObjects = data
	}

	getQueryTypes() {
		return Object.keys(this.queryObjects)
	}
}

module.exports = Entity
