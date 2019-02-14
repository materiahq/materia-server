import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { ICustomQueryOptions } from '@materia/interfaces';

import { MateriaError } from '../../error';
import { Entity } from '../entity';
import { Query, QueryParamResolver } from '../query';

export class Model {
	modelClass: any;
	modelStr: string;
	modelInstances: { [entity: string]: any };

	constructor() {
		this.modelInstances = {};
	}

	load(name: string, entity: Entity): void {
		const basePath = entity.fromAddon
			? entity.fromAddon.path
			: entity.app.path;
		const modelPath = require.resolve(
			path.join(basePath, 'server', 'models', 'queries', name + '.js')
		);
		try {
			if (require.cache[modelPath]) {
				delete require.cache[modelPath];
			}
			this.modelClass = require(modelPath);
			this.modelStr = fs.readFileSync(modelPath, 'utf-8').toString();
			delete this.modelInstances[entity.name];
		} catch (e) {
			const err = new MateriaError(
				'Could not load model ' + name + ' from entity ' + entity.name
			) as any;
			err.originalError = e;
			throw err;
		}
	}

	instance(entity: Entity): any {
		if (!this.modelInstances[entity.name]) {
			this.modelInstances[entity.name] = new this.modelClass(
				entity.app,
				entity
			);
		}
		return this.modelInstances[entity.name];
	}
}

export class CustomQuery extends Query {
	type: string;
	action: string;
	model: string;
	static models: { [name: string]: Model } = {};

	constructor(entity, id, opts) {
		super(entity, id);

		this.type = 'custom';

		if (!opts || !opts.action) {
			throw new MateriaError('Missing required parameter "action"');
		}

		this.params = opts.params || [];
		this.action = opts.action;
		this.model = opts.model || entity.name.toLowerCase();
		try {
			this.refresh();
			this.discoverParams();
		} catch (e) {
			this.entity.app.logger.error(e);
		}
	}

	static resetModels(): void {
		CustomQuery.models = {};
	}

	refresh() {
		const model = this._getModel();

		model.load(this.model, this.entity);

		if (!model.modelClass.prototype[this.action]) {
			throw new MateriaError(
				`cannot find method ${this.action} in model queries/${
					this.model
				}.js`
			);
		}
	}

	discoverParams() {}

	resolveParams(params) {
		let success = true;
		for (const field of this.params) {
			try {
				QueryParamResolver.resolve(
					{ name: field.name, value: '=' },
					params
				);
			} catch (e) {
				if (field.required) {
					success = false;
				}
			}
		}
		if (success) { return Promise.resolve(); } else { return Promise.reject(new MateriaError('Missing required parameter')); }
	}

	private _run(instance, params) {
		try {
			const res = instance[this.action](params || {});
			if (res && res.then && res.catch) {
				// promise
				return res;
			} else {
				return Promise.resolve(res);
			}
		} catch (e) {
			return Promise.reject(e);
		}
	}

	run(params): Promise<any> {
		this.entity.app.logger.log(
			`${chalk.bold('(Query)')} Javascript - Run ${chalk.bold(
				this.entity.name
			)}.${chalk.bold(this.id)}`
		);
		this.entity.app.logger.log(
			` └── Parameters: ${JSON.stringify(params)}\n`
		);

		const instance = this._getModel().instance(this.entity);
		return this.resolveParams(params)
			.catch(e =>
				this.handleBeforeActions(params, false)
					.then(() => Promise.reject(e))
					.catch(() => Promise.reject(e))
			).then(() =>
				this.handleBeforeActions(params, true)
			).then(() =>
				this._run(instance, params)
					.then(res =>
						this.handleAfterActions(params, res, true)
							.then(() => res)
							.catch(e => res)
					)
					.catch(e =>
					this.handleAfterActions(params, null, false)
							.then(() => Promise.reject(e))
							.catch(() => Promise.reject(e))
					)
			);
	}

	toJson() {
		const opts: ICustomQueryOptions = {
			params: this.paramsToJson(),
			action: this.action
		};
		if (this.model != this.entity.name.toLowerCase()) {
			opts.model = this.model;
		}
		return {
			id: this.id,
			type: 'custom',
			opts: opts
		};
	}

	private _getModel(): Model {
		const model_prefix = this.entity.fromAddon
			? this.entity.fromAddon.package + '/'
			: '';
		if (!CustomQuery.models[model_prefix + this.model]) {
			CustomQuery.models[model_prefix + this.model] = new Model();
		}
		return CustomQuery.models[model_prefix + this.model];
	}
}
