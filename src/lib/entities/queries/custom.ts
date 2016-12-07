import * as fs from 'fs'
import * as path from 'path'

import App from '../../app'
import MateriaError from '../../error'

import { Entity } from '../entity'
import { Query, IQueryParam } from '../query'

export interface ICustomQueryOpts {
	action: string
	model?: string
	params: IQueryParam[]
}

class Model {
	private app: App
	private entity: Entity
	modelClass: any
	modelStr: string
	modelInstance: any

	constructor(entity:Entity) {
		this.app = entity.app;
		this.entity = entity;
	}

	load(name:string):void {
		let basePath = this.entity.fromAddon ? this.entity.fromAddon.path : this.entity.app.path
		let modelPath = require.resolve(path.join(basePath, 'server', 'models', 'queries', name + '.js'))
		try {
			if (require.cache[modelPath]) {
				delete require.cache[modelPath]
			}
			this.modelClass = require(modelPath)
			this.modelStr = fs.readFileSync(modelPath, 'utf8').toString()
			delete this.modelInstance
		} catch(e) {
			let err = new MateriaError('Could not load model ' + name + ' from entity ' + this.entity.name) as any
			err.originalError = e
			throw err
		}
	}

	instance():any {
		if ( ! this.modelInstance) {
			this.modelInstance = new this.modelClass(this.app, this.entity)
		}
		return this.modelInstance
	}
}

export class CustomQuery extends Query {
	type: string
	action: string
	model: string
	static models: {[name:string]: Model} = {}

	constructor(entity, id, opts) {
		super(entity, id);

		this.type = 'custom'

		if ( ! opts || ! opts.action)
			throw new MateriaError('missing required parameter "action"')

		this.params = opts.params
		this.action = opts.action
		this.model = opts.model || entity.name.toLowerCase()

		this.refresh()

		this.discoverParams()
	}

	refresh() {
		let model = this._getModel()

		model.load(this.model)

		if ( ! model.modelClass.prototype[this.action]) {
			throw new MateriaError(`cannot find method ${this.action} in model queries/${this.model}.js`)
		}
	}

	discoverParams() {}

	run(params) {
		let instance = this._getModel().instance()
		try {
			return Promise.resolve(instance[this.action](params))
		} catch (e) {
			return Promise.reject(e)
		}
	}

	toJson() {
		let opts : ICustomQueryOpts = {
			params: this.paramsToJson(),
			action: this.action
		}
		if (this.model != this.entity.name.toLowerCase()) {
			opts.model = this.model
		}
		return {
			id: this.id,
			type: 'custom',
			opts: opts
		}
	}

	private _getModel():Model {
		let model_prefix = this.entity.fromAddon ? this.entity.fromAddon.name + "/" : ""
		if ( ! CustomQuery.models[model_prefix + this.model]) {
			CustomQuery.models[model_prefix + this.model] = new Model(this.entity)
		}
		return CustomQuery.models[model_prefix + this.model]
	}
}