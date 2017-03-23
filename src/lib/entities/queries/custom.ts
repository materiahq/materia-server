import * as fs from 'fs'
import * as path from 'path'

import App from '../../app'
import MateriaError from '../../error'

import { Entity } from '../entity'
import { Query, IQueryParam, QueryParamResolver } from '../query'

export interface ICustomQueryOpts {
	action: string
	model?: string
	params: IQueryParam[]
}

class Model {
	modelClass: any
	modelStr: string
	modelInstances: {[entity:string]:any}

	constructor() {
		this.modelInstances = {}
	}

	load(name:string, entity:Entity):void {
		let basePath = entity.fromAddon ? entity.fromAddon.path : entity.app.path
		let modelPath = require.resolve(path.join(basePath, 'server', 'models', 'queries', name + '.js'))
		try {
			if (require.cache[modelPath]) {
				delete require.cache[modelPath]
			}
			this.modelClass = require(modelPath)
			this.modelStr = fs.readFileSync(modelPath, 'utf8').toString()
			delete this.modelInstances[entity.name]
		} catch(e) {
			let err = new MateriaError('Could not load model ' + name + ' from entity ' + entity.name) as any
			err.originalError = e
			throw err
		}
	}

	instance(entity:Entity):any {
		if ( ! this.modelInstances[entity.name]) {
			this.modelInstances[entity.name] = new this.modelClass(entity.app, entity)
		}
		return this.modelInstances[entity.name]
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
			throw new MateriaError('Missing required parameter "action"')

		this.params = opts.params || []
		this.action = opts.action
		this.model = opts.model || entity.name.toLowerCase()

		this.refresh()

		this.discoverParams()
	}

	static resetModels():void {
		CustomQuery.models = {}
	}

	refresh() {
		let model = this._getModel()

		model.load(this.model, this.entity)

		if ( ! model.modelClass.prototype[this.action]) {
			throw new MateriaError(`cannot find method ${this.action} in model queries/${this.model}.js`)
		}
	}

	discoverParams() {}

	run(params):Promise<any> {
		let instance = this._getModel().instance(this.entity)
		try {
			for (let field of this.params) {
				try {
					QueryParamResolver.resolve({ name: field.name, value: "=" }, params)
				} catch(e) {
					if (field.required)
						throw e
				}
			}
			return Promise.resolve(instance[this.action](params || {}))
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
		let model_prefix = this.entity.fromAddon ? this.entity.fromAddon.package + "/" : ""
		if ( ! CustomQuery.models[model_prefix + this.model]) {
			CustomQuery.models[model_prefix + this.model] = new Model()
		}
		return CustomQuery.models[model_prefix + this.model]
	}
}