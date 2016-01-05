'use strict';

var fs = require('fs')
var path = require('path')
var DBEntity = require('./entities/db-entity')
var Entity = require('./entities/abstract/entity')

/*
** Entity Manager
*/

class Entities {
	constructor(app) {
		this.app = app
		this.DiffType = app.history.DiffType
		this.entities = {}
		this.relations = []

		this.app.history.register(this.DiffType.CREATE_ENTITY, (data) => {
			return this.add(data.value, {history:false})
		})

		this.app.history.register(this.DiffType.RENAME_ENTITY, (data) => {
			return this.rename(data.table, data.value, {history:false})
		})

		this.app.history.register(this.DiffType.DELETE_ENTITY, (data) => {
			return this.remove(data.table, {history:false})
		})

		this.app.history.register(this.DiffType.ADD_FIELD, (data) => {
			return this.get(data.table).addFieldAt(data.value, data.position, {history:false})
		})

		this.app.history.register(this.DiffType.ADD_QUERY_PARAM, (data) => {
			return this.get(data.table).getQuery(data.id).addParam(data.value, {history:false})
		})

		this.app.history.register(this.DiffType.DELETE_QUERY_PARAM, (data) => {
			return this.get(data.table).getQuery(data.id).delParam(data.value, {history:false})
		})

		this.app.history.register(this.DiffType.UPDATE_QUERY_VALUE, (data) => {
			return this.get(data.table).getQuery(data.id).updateValue(data.value.name, data.value.value, {history:false})
		})

//		this.app.history.register('change_column', {
//		})

		this.app.history.register(this.DiffType.DELETE_FIELD, (data) => {
			return this.get(data.table).removeField(data.value, {history:false})
		})

//		this.app.history.register('add_foreign_key', {
//		})

//		this.app.history.register('delete_foreign_key', {
//		})
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
					throw e
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
			entity = new DBEntity(this.app, entityobj.name)
			createPromise = entity.create(entityobj.fields, entityobj.relations, entityobj.queries, {wait_relations:options.wait_relations})
		}

		return new Promise((accept, reject) => {
			createPromise.then(() => {
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

				if (options.save != false)
					entity.save()

				this.entities[entity.name] = entity
				this.app.emit('entity:added', entity)

				if (options.db == false)
					return accept(entity)

				this.sync()
				entity.refreshQueries()

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
		delete this.entities[name]

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
			fs.unlinkSync(path.join(this.app.path, 'entities', name + '.json'))
		}

		if (options.db == false)
			return Promise.resolve()

		// TODO: remove constraint to avoid force:true ? more tests needed
		return this.app.database.sequelize.getQueryInterface().dropTable(name, {force:true})
	}

	rename(name, new_name, options) {
		options = options || {}
		let entity = this.get(name)

		if ( ! entity || this.get(new_name))
			return Promise.reject()

		if (options.history != false) {
			this.app.history.push({
				type: this.DiffType.RENAME_TABLE,
				table: name,
				value: new_name
			},{
				type: this.DiffType.RENAME_TABLE,
				table: new_name,
				value: name
			})
		}

		for (let relation in this.app.relations.findAll()) {
			relation.rename(name, new_name)
		}

		for (let ent of this.entities) {
			ent.getRelations().forEach((relation) => {
				if (relation.dst == name) {
					relation.dst = new_name
				}
				if (relation.src == name) {
					relation.src = new_name
				}
			})
		}

		if (entity.fields[0].name == 'id_' + name) {
			entity.fields[0].name = 'id_' + new_name
			// TODO: rename field (with options db:options.db save:false history:false)
		}

		if (options.save != false) {
			fs.unlinkSync(path.join(this.app.path, 'entities', this.name + '.json'))
			this.save()
		}

		this.entities[new_name] = entity
		delete this.entities[name]

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

	save() {
		for (let ent in this.entities) {
			this.entities[ent].save()
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

	findAllRelations() {
		let res = []
		for (let ent in this.entities) {
			let relations = this.entities[ent].getRelations()
			if (relations.length > 0) {
				relations.forEach((r) => {
					r.entity = ent
					res.push(r)
				})
			}
		}
		//console.log('relations:', res)
		return res
	}
	/*findAllRelations() {
		return this.relations
	}*/
}

module.exports = Entities
