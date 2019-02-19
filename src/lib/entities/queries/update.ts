import chalk from 'chalk';
import * as Sequelize from 'sequelize';
import { IQuery, IUpdateQueryOptions, IQueryValues } from '@materia/interfaces';

import { Query, QueryParamResolver } from '../query';
import { Conditions } from './utils/conditions';
import { DBEntity } from '../db-entity';

export class UpdateQuery extends Query {
	type: string;
	values: IQueryValues;
	conditions: Conditions;
	valuesType: any;

	constructor(entity: DBEntity, id: string, opts: IUpdateQueryOptions) {
		super(entity, id);

		this.type = 'update';

		this.values = {};
		if ( ! opts ) {
			opts = {} as IUpdateQueryOptions;
		}
		if (opts.values) {
			this.values = opts.values;
		}

		this.conditions = new Conditions(opts.conditions, this);

		this.discoverParams();
	}

	refresh() {}

	discoverParams() {
		this.valuesType = {};
		this.params = [];
		Object.keys(this.values).forEach(fieldName => {
			if (this.values[fieldName] && this.values[fieldName].substr(0, 1) == '=') {
				this.valuesType[fieldName] = 'param';
				let paramName = fieldName;
				if (this.values[fieldName].length > 1) {
					paramName = this.values[fieldName].substr(1);
				}
				const field = this.entity.getField(fieldName);
				this.params.push({
					name: paramName,
					type: field.type,
					required: false,
					component: field.component,
					reference: {
						entity: this.entity.name,
						field: fieldName
					}
				});
			} else {
				this.valuesType[fieldName] = 'value';
			}
		});

		this.params = this.params.concat(this.conditions.discoverParams());
	}

	resolveParams(params) {
		const res = {};
		for (const field in this.values) {
			if (field) {
				try {
					res[field] = QueryParamResolver.resolve({ name: field, value: this.values[field] }, params);
				} catch (e) {
					if ( this.values[field].substr(0, 1) == '=') {
						const t = this.getParam(this.values[field].substr(1));
						if (t && t.required) {
							throw e;
						}
					}
				}
			}
		}
		for (const field of this.params) {
			if ( field && ! this.values[field.name]) {
				try {
					res[field.name] = QueryParamResolver.resolve({ name: field.name, value: '=' }, params);
				} catch (e) {
					if (field.required) {
						throw e;
					}
				}
			}
		}

		return res;
	}

	run(params): Promise<any> {
		this.entity.app.logger.log(`${chalk.bold('(Query)')} Update - Run ${chalk.bold(this.entity.name)}.${chalk.bold(this.id)}`);
		this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(params)}\n`);
		let updates, where;
		try {
			updates = this.resolveParams(params);
			where = this.conditions.toSequelize(params, this.entity.name);
		} catch (e) {
			return this.handleBeforeActions(params, false)
				.then(() => Promise.reject(e))
				.catch(() => Promise.reject(e));
		}

		return this.handleBeforeActions(params, true)
			.then(() => {
				const opts: Sequelize.UpdateOptions = { where: {}};
				if (where) {
					opts.where = where;
				}
				return this.entity.model.update(updates, opts);
			}).then(res =>
				this.handleAfterActions(params, res, true)
					.then(() => res)
					.catch(e => res)
			)
			.catch(e =>
				this.handleAfterActions(params, null, false)
					.then(() => Promise.reject(e))
					.catch(() => Promise.reject(e))
			);
	}

	toJson(): IQuery {
		const res = {
			id: this.id,
			type: 'update',
			opts: {
				values: this.values,
				conditions: this.conditions.toJson()
			} as IUpdateQueryOptions
		};
		return res;
	}
}