import { IQueryParam } from '@materia/interfaces';

import { DBEntity } from './db-entity';
import { MateriaError } from '../error';

export class QueryParamResolver {

	static resolve(field: any, params: any) {
		if (typeof field.value == 'string' && field.value.substr(0, 1) == '=') {

			let paramName = field.name;
			if (field.value.length > 1) {
				paramName = field.value.substr(1);
			}

			if (params.params && params.params[paramName] !== undefined) {
				return params.params[paramName];
			}
			if (params.data && params.data[paramName] !== undefined) {
				return params.data[paramName];
			}
			if (params[paramName] !== undefined) {
				return params[paramName];
			}
			throw new MateriaError('Missing required parameter: ' + paramName);
		}

		if (typeof field.value == 'string' && field.value.substr(0, 1) == '%') {
			let paramName = field.name;
			if (field.value.length > 1) {
				paramName = field.value.substr(1);
			}

			if (params.headers) {
				return params.headers[paramName];
			}

			throw new MateriaError('header not found ' + paramName);
		}

		return field.value;
	}
}

export interface IQueryConstructor {
	new (entity: DBEntity, id: string, opts: any);
	toJson();
}

export abstract class Query {
	params: IQueryParam[];
	readonly id: string;

	constructor(public entity: DBEntity, id: string) {
		this.entity = entity;
		// this.history = entity.app.history
		this.id = id;
		this.params = [];
	}

	abstract discoverParams();
	abstract refresh();
	abstract toJson();

	abstract run(params?: any, options?: any): Promise<any>;

	handleBeforeActions(params, success: boolean) {
		return this.entity.app.actions.handle('beforeQuery', {
			entity: this.entity.name,
			query: this.id
		}, params, success);
	}

	handleAfterActions(params, response, success) {
		return this.entity.app.actions.handle('afterQuery', {
			entity: this.entity.name,
			query: this.id
		}, Object.assign({}, params, response), success);
	}

	updateOption(name, value, options) {
		return Promise.reject(new MateriaError('not implemented yet'));
	}

	hasParameters(): boolean {
		return this.params.length > 0;
	}

	getAllParams(): Array<IQueryParam> {
		return this.params;
	}

	getParam(name): IQueryParam {
		for (const param of this.params) {
			if (param.name == name) {
				return param;
			}
		}
		return null;
	}

	hasRequiredParameters(): boolean {
		for (const param of this.params) {
			if (param.required) {
				return true;
			}
		}
		return false;
	}

	constructInclude(includeArray, includedName) {
		for (const entity of includedName) {
			const includeEntity = this.entity.app.entities.get(entity.entity) as DBEntity;
			if ( ! includeEntity) {
				throw new MateriaError(`Cannot find included entity ${entity.entity}`);
			}
			const includePart = {
				model: includeEntity.model,
				attributes: entity.fields
			} as any;

			if (entity.include) {
				includePart.include = [];
				const includeNames = entity.include;
				this.constructInclude(includePart.include, includeNames);
			}
			includeArray.push(includePart);
		}
	}

	protected paramsToJson() {
		if ( ! this.params) {
			return undefined;
		}
		const _params = [];
		for (const param of this.params) {
			const _param = {
				name: param.name,
				type: param.type
			};
			if (param.required) {
				_param['required'] = param.required;
			}
			if (param.component) {
				_param['component'] = param.component;
			}
			if (param.reference) {
				_param['reference'] = {
					entity: param.reference.entity,
					field: param.reference.field
				};
			}
			_params.push(_param);
		}
		return _params;
	}
}
