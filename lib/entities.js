'use strict';

var fs = require('fs')
var path = require('path')
var DBEntity = require('./entities/db-entity')
var Entity = require('./entities/entity')

/*
** Entity Manager
*/

class Entities {
	constructor(app) {
		this.app = app
		this.DiffType = app.history.DiffType
		this.entities = {}
		this.relations = []

		this.app.history.register(this.DiffType.CREATE_ENTITY, (data, opts) => {
			return this.add(data.value, opts)
		})

		this.app.history.register(this.DiffType.RENAME_ENTITY, (data, opts) => {
			return this.rename(data.table, data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_ENTITY, (data, opts) => {
			return this.remove(data.table, opts)
		})

		this.app.history.register(this.DiffType.ADD_FIELD, (data, opts) => {
			return this.get(data.table).addFieldAt(data.value, data.position, opts)
		})

		this.app.history.register(this.DiffType.CHANGE_FIELD, (data, opts) => {
			return this.get(data.table).updateField(data.name, data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_FIELD, (data, opts) => {
			return this.get(data.table).removeField(data.value, opts)
		})


		this.app.history.register(this.DiffType.ADD_RELATION, (data, opts) => {
			return this.get(data.table).addRelation(data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_RELATION, (data, opts) => {
			return this.get(data.table).removeRelation(data.value, opts)
		})


		this.app.history.register(this.DiffType.ADD_QUERY, (data, opts) => {
			return this.get(data.table).addQuery(data.id, data.values.type, data.values.params, data.values.opts, opts)
		})

		this.app.history.register(this.DiffType.DELETE_QUERY, (data, opts) => {
			return this.get(data.table).removeQuery(data.id, opts)
		})

		this.app.history.register(this.DiffType.ADD_QUERY_PARAM, (data, opts) => {
			return this.get(data.table).getQuery(data.id).addParam(data.value, opts)
		})

		this.app.history.register(this.DiffType.DELETE_QUERY_PARAM, (data, opts) => {
			return this.get(data.table).getQuery(data.id).delParam(data.value, opts)
		})

		this.app.history.register(this.DiffType.UPDATE_QUERY_VALUE, (data, opts) => {
			return this.get(data.table).getQuery(data.id).updateValue(data.value.name, data.value.value, opts)
		})
	}

	load() {
		return new Promise((accept, reject) => {
			this.entities = {}
			let files;
			try {
				files = fs.readdirSync(path.join(this.app.path, 'entities'))
			} catch (e) {
				files = []
				fs.mkdirSync(path.join(this.app.path, 'entities'))
				return accept(false)
			}

			let promises = []

			files.forEach((file) => {
				try {
					if (file.substr(file.length - 5, 5) == '.json') {
						let content = fs.readFileSync(path.join(this.app.path, 'entities', file))
						let entity = JSON.parse(content.toString())
						promises.push(this.add(entity, {history: false, db: false, save: false, wait_relations:true}));
					}
				} catch (e) {
					e += ' in ' + file
					throw new Error(e)
				}
			})

			Promise.all(promises).then(() => {
				promises = []
				for (let name in this.entities)
					promises.push(this.entities[name].applyRelations())
				return Promise.all(promises)
			}).then(() => {
				accept()
			}).catch((err) => {
				reject(err)
			})
		})
	}

	//Add an Entity
	add(entityobj, options) {
		options = options || {}

		let entity, createPromise
		if (entityobj instanceof Entity) {
			entity = entityobj
			createPromise = Promise.resolve()
		} else {
			if (! entityobj.name)
				return Promise.reject(new Error('missing entity name'))
			entity = new DBEntity(this.app, entityobj.name)
			let fields = entityobj.fields
			if ( ! entityobj.isRelation && (! fields || ! fields.length)) {
				fields = [
					{
						"name": "id",
						"type": "number",
						"required": true,
						"primary": true,
						"unique": true,
						"default": false,
						"autoIncrement": true,
						"read": true,
						"write": false
					}
				]
			}
			if (entityobj.overwritable && this.entities[entity.name] && this.apply)
				return Promise.resolve(entity)
			if (entityobj.isRelation && entityobj.relations)
				delete entityobj.relations
			createPromise = entity.create(fields, entityobj.relations, entityobj.queries, entityobj.isRelation, {wait_relations:options.wait_relations})
		}

		return new Promise((accept, reject) => {
			createPromise.then(() => {
				if (options.save != false)
					entity.save(options)

				if (options.apply != false) {
					this.entities[entity.name] = entity
					this.app.emit('entity:added', entity)
				}

				if (options.overwritable)
					return accept(entity)

				if (options.history != false) {
					this.app.history.push({
						type: this.DiffType.CREATE_ENTITY,
						table: entity.name,
						value: entity.toJson()
					},{
						type: this.DiffType.DELETE_ENTITY,
						table: entity.name
					})
				}

				if (options.db == false)
					return accept(entity)

				if (options.apply != false) {
					entity.initDefaultQuery()
					this.sync()
					entity.refreshQueries()
				}
				else {
					entity.loadModel()
				}

				entity.model.sync().then(function() {
					accept(entity)
				}, function(err) {
					reject(err)
				})
			}, function(err) {
				reject(err)
			})
		})
	}

	remove(name, options) {
		options = options || {}
		if ( ! name) {
			return false
		}

		let entity = this.entities[name]
		if (options.apply != false) {
			delete this.entities[name]
		}

		if (options.history != false) {
			this.app.history.push({
				type: this.DiffType.DELETE_ENTITY,
				table: entity.name
			},{
				type: this.DiffType.CREATE_ENTITY,
				table: entity.name,
				value: entity.toJson()
			})
		}

		if (options.save != false && entity && fs.existsSync(path.join(this.app.path, 'entities', name + '.json'))) {
			if (options && options.beforeSave) {
				options.beforeSave()
			}
			fs.unlinkSync(path.join(this.app.path, 'entities', name + '.json'))
			if (options && options.afterSave) {
				options.afterSave()
			}
		}

		if (options.db == false)
			return Promise.resolve()

		// TODO: remove constraint to avoid force:true ? more tests needed
		return this.app.database.sequelize.getQueryInterface().dropTable(name, {force:true})
	}

	rename(name, new_name, options) {
		options = options || {}
		let entity = this.get(name)

		if ( ! entity)
			return Promise.reject(new Error('Entity ' + name + ' does not exist.'))

		if ( this.get(new_name))
			return Promise.reject(new Error('Entity ' + new_name + ' already exists.'))

		if (options.history != false) {
			this.app.history.push({
				type: this.DiffType.RENAME_ENTITY,
				table: name,
				value: new_name
			},{
				type: this.DiffType.RENAME_ENTITY,
				table: new_name,
				value: name
			})
		}

		if (options.apply != false) {
			for (let entity_name in this.entities) {
				let entity = this.entities[entity_name]
				for (let relation of entity.relations) {
					if (relation.reference && relation.reference.entity == name)
						relation.reference.entity = new_name
				}
			}

			if (entity.fields[0].name == 'id_' + name) {
				entity.fields[0].name = 'id_' + new_name
				// TODO: rename field (with options db:options.db save:false history:false)
			}

			entity.name = new_name
			this.entities[new_name] = entity
			delete this.entities[name]
		}

		if (options.save != false) {
			if (options && options.beforeSave) {
				options.beforeSave()
			}
			fs.unlinkSync(path.join(this.app.path, 'entities', name + '.json'))
			if (options && options.afterSave) {
				options.beforeSave()
			}
			this.save(options)
		}


		if (options.db == false)
			return Promise.resolve()

		return this.app.database.sequelize.getQueryInterface().renameTable(name, new_name)
	}

	findAll() {
		let ents = []
		for (let ent in this.entities)
			ents.push(this.entities[ent])
		return ents
	}

	get(name) { return this.entities[name] }

	getOrAdd(name, entityobj, options) {
		return new Promise((accept, reject) => {
			if (this.entities[name])
				return accept(this.entities[name])
			this.add(entityobj, options).then((entity) => {
				accept(entity)
			}, (err) => {
				reject(err)
			})
		})
	}

	save(opts) {
		for (let ent in this.entities) {
			this.entities[ent].save(opts)
		}
	}

	/*getCurrentDiff() {
		let diffs = []
		this.entities.forEach((entity) => {
			//entity.
		})
	}

	hasDiff() {
		for (let entity of this.entities) {

		}
	}*/

	sync() {
		for (let ent in this.entities) {
			this.entities[ent].loadModel()
		}

		//Need a second loop to executes relations when all models are created
		for (let ent in this.entities) {
			this.entities[ent].loadRelationsInModel()
		}
	}

	toJson() {
		let res = {entities: [], relations: []}
		for (let ent in this.entities) {
			res.entities.push(this.entities[ent].toJson())
		}

		for (let rel in this.relations) {
			res.relations.push(this.relations[rel].toJson())
		}

		return res
	}

	findAllRelations(opts) {
		opts = opts || {}
		let res = []
		for (let ent in this.entities) {
			let entity = this.entities[ent]
			for (let r of entity.relations) {
				if ( ! r.implicit || opts.implicit) {
					r.entity = ent
					res.push(r)
				}
			}
			if (entity.isRelation && opts.implicit) {
				for (let f of entity.getFields()) {
					let r = f.isRelation
					if (r) {
						r.entity = ent
						r.implicit = true
						r.field = f.name
						res.push(r)
					}
				}
			}
		}
		return res
	}
}

module.exports = Entities
