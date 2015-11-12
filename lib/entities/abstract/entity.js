'use strict';

var fs = require('fs')
var path = require('path')
var Field = require('./field')

var _ = require('lodash')
//var an = require('../../utils/an')
//var ucfirst = require('../../utils/ucfirst')

class Entity {
	constructor(app, name, fields, relations, queries, queryTypes) {
		this.app = app
		this.name = name

		//console.log '##### in Entity constructor'
		this.fields = []
		this.relations = []
		this.queries = []
		this.queryObjects = {}
		if (fields) {
			fields.forEach((field) => {
				this.addField(field)
			})
		}

		if (relations) {
			relations.forEach((relation) => {
				this.addRelation(relation)
				//this.addRelation()
			})
		}

		if (queryTypes) {
			this.defineQueryObjects(queryTypes)
		}

		if (queries) {
			queries.forEach((query) => {
				this.addQuery(query.id, query.type, query.params, query.opts)
			})
		}
	}

	save() { fs.writeFileSync(path.join(this.app.path, 'entities', this.name + '.json'), JSON.stringify(this.toJson(), null, 2)) }

	rename(name) {
		for (entity in this.app.entities.findAll()) {
			if (entity.name == name) {
				return false
			}
		}
		if ( ! name) {
			return false
		}

		for (relation in this.app.relations.findAll()) {
			relation.rename(this.name, name)
		}

		this.app.entities.findAll().forEach((entity) => {
			entity.getRelations().forEach((relation) => {
				if (relation.dst == this.name) {
					relation.dst = name
				}
				if (relation.src == this.name) {
					relation.src = name
				}
			})
		})

		if (this.fields[0].name == 'id_' + this.name) {
			this.fields[0].name = 'id_' + name
		}

		fs.unlinkSync(path.join(this.app.path, 'entities', this.name + '.json'))
		this.name = name
		this.save()

		return true
	}

	remove() {
		//TODO: need to check if it removes relations
		this.app.entities.remove(this.name)
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

	addRelation(relation) {
		let entityDest = this.app.entities.get(relation.reference.entity)
		if ( ! relation.type || relation.type == 'belongsTo') {
			let keyReference = entityDest.getPK()
			if (relation.reference.field && relation.reference.field != keyReference.name) {
				let f = entityDest.getField(relation.reference.field)
				if ( ! f.unique) {
					throw f.name + ' cannot be a key (need unique/primary field)'
				}
				keyReference = f
			}
			this.relations.push(relation)
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
			}, true, false)
		}
		else if (relation.type == 'hasMany') {
			//this.relations.push(relation) ???

			//add query type for getAll...
		}
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

	addField(field) {
		if ( ! field.name) {
			return false
		}
		field.edit = false
		this.fields.push(new Field(this, field))

		return this.fields[this.fields.length - 1]
	}

	addFieldFirst(field) {
		if ( ! field.name) {
			return false
		}
		field.edit = false
		this.fields.unshift(new Field(this, field))
		return this.fields[this.fields.length - 1]
	}

	removeField(name) {
		if (! name) {
			return false
		}
		this.fields.forEach((field, k) => {
			if (field.name == name) {
				this.fields.splice(k, 1)
			}
		})
		this.initPK()
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

	getQueries() { return this.queries }

	defineQueryObjects(data) {
		this.queryObjects = data
	}

	getQueryTypes() {
		return Object.keys(this.queryObjects)
	}
}

module.exports = Entity
