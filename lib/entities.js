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
			return this.add(data.value, true)
		})
		
		this.app.history.registerApply(this.DiffType.CREATE_ENTITY, (data, queryInterface) => {
			let ent = this.get(data.table)
			//ent.loadModel()
			//ent.loadRelationsInModel()
			if ( ! ent)
				return Promise.accept() // the table does not exists in the future so skip creation
			ent.sync()
			ent.refreshQueries()

			// the table should already exist so sync it should be suffisent. more tests are welcome
			//return queryInterface.createTable(data.table, this.app.database._translateFields(data.fields))
		})
		
		this.app.history.register(this.DiffType.RENAME_ENTITY, (data) => {
			return this.get(data.table).rename(data.value, true)
		})
		
		this.app.history.registerApply(this.DiffType.RENAME_ENTITY, (data, queryInterface) => {
			return queryInterface.renameTable(data.table, data.value)
		})
		
		this.app.history.register(this.DiffType.DELETE_ENTITY, (data) => {
			return this.remove(data.table, true)
		})
		
		this.app.history.registerApply(this.DiffType.DELETE_ENTITY, (data, queryInterface) => {
			// TODO: remove references before delete instead of force:true ?
			return queryInterface.dropTable(data.table, {force:true})
		})
		
		this.app.history.register(this.DiffType.ADD_FIELD, (data) => {
			return this.get(data.table).addFieldAt(data.value, data.position, true)
		})
		
		this.app.history.registerApply(this.DiffType.ADD_FIELD, (data, queryInterface) => {
			let ent = this.get(data.table)
			ent.loadModel()
			ent.loadRelationsInModel()
			ent.refreshQueries()
			return ent.addDbFieldAt(queryInterface, data.value, data.position)
		})
		
//		this.app.history.register('change_column', {
//		})
		
		this.app.history.register(this.DiffType.DELETE_FIELD, (data) => {
			return this.get(data.table).removeField(data.value, true)
		})
		
		this.app.history.registerApply(this.DiffType.DELETE_FIELD, (data, queryInterface) => {
			let ent = this.get(data.table)
			ent.loadModel()
			ent.loadRelationsInModel()
			ent.refreshQueries()
			return ent.removeDbField(queryInterface, data.value)
		})
		
//		this.app.history.register('add_foreign_key', {
//		})
		
//		this.app.history.register('delete_foreign_key', {
//		})
	}

	load() {
		this.entities = {}
		let files;
		try {
			files = fs.readdirSync(path.join(this.app.path, 'entities'))
		} catch (e) {
			files = []
			fs.mkdirSync(path.join(this.app.path, 'entities'))
			return false
		}

		files.forEach((file) => {
			try {
				if (file.substr(file.length - 5, 5) == '.json') {
					let content = fs.readFileSync(path.join(this.app.path, 'entities', file))
					let entity = JSON.parse(content.toString())
					this.add(entity);
				}
			} catch (e) {
				e += ' in ' + file
				throw e
			}
		})
	}

	//Add an Entity
	add(entity, ignore_history) {
		if ( ! (entity instanceof Entity))
			entity = new DBEntity(this.app, entity.name, entity.fields, entity.relations, entity.queries)
		if ( ! ignore_history) {
			this.app.history.push({
				type: this.DiffType.CREATE_ENTITY,
				table: entity.name,
				value: entity.toJson()
			},{
				type: this.DiffType.DELETE_ENTITY,
				table: entity.name
			})
		}
		this.entities[entity.name] = entity
		this.app.emit('entity:added', entity)
		return entity
	}

	remove(name, ignore_history) {
		if ( ! name) {
			return false
		}
		let entity = this.entities[name]
		delete this.entities[name]
		
		if ( ! ignore_history) {
			this.app.history.push({
				type: this.DiffType.DELETE_ENTITY,
				table: entity.name
			},{
				type: this.DiffType.CREATE_ENTITY,
				table: entity.name,
				value: entity.toJson()
			})
		}

		if (entity && fs.existsSync(path.join(this.app.path, 'entities', name + '.json'))) {
			fs.unlinkSync(path.join(this.app.path, 'entities', name + '.json'))
		}
	}

	findAll() {
		let ents = []
		for (let ent in this.entities)
			ents.push(this.entities[ent])
		return ents
	}

	get(name) { return this.entities[name] }

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

	/*
	addRelation(relation) {
		this.relations.push(relation)
		this.app.emit('relation:added', this.relations)
		return relation
	}

	removeRelation(id) {
		this.relations.splice(id, 1)
		this.app.emit('relation:removed', this.relations)
	}*/

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
