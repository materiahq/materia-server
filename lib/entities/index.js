'use strict';

var fs = require('fs')
var path = require('path')
var DBEntity = require('./db-entity')
var Entity = require('./abstract/entity')

/*
** Entity Manager
*/

class Entities {
	constructor(app) {
		this.app = app
		this.entities = {}
		this.relations = []
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
					let entity = JSON.parse(content)
					this.add(entity);
				}
			} catch (e) {
				e += ' in ' + file
				throw e
			}
		})
	}

	//Add an Entity
	add(entity) {
		if ( ! (entity instanceof Entity))
			entity = new DBEntity(this.app, entity.name, entity.fields, entity.relations, entity.queries)
		this.entities[entity.name] = entity
		this.app.emit('entity:added', entity)
		return entity
	}

	remove(name) {
		if ( ! name) {
			return false
		}
		let find = this.entities[name] != undefined
		delete this.entities[name]

		if (find && fs.existsSync(path.join(this.app.path, 'entities', name + '.json'))) {
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
