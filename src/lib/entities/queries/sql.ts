import chalk = require('chalk');
import { QueryTypes } from 'sequelize';

import { Query, QueryParamResolver } from '../query';
import { MateriaError } from '../../error';

export class SQLQuery extends Query {
	type: string;
	// TODO: remove values & opts.values as it could be deduct form opts.params
	values: any;
	query: string;
	valuesType: any;

	constructor(entity, id, opts) {
		super(entity, id);

		if ( ! opts || ! opts.query ) {
			throw new MateriaError('Missing required parameter "query"');
		}

		this.type = 'sql';

		this.params = opts.params || [];
		this.values = opts.values || {};
		this.query = opts.query;

		this.refresh();
		this.discoverParams();
	}

	refresh() {
		this.valuesType = {};
		Object.keys(this.values).forEach((field) => {
			if (this.values[field].substr(0, 1) == '=') {
				this.valuesType[field] = 'param';
			} else {
				this.valuesType[field] = 'value';
			}
		});
	}

	discoverParams() {
		// does nothing as params is defined in opts.params
		// cf constructor
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
		this.entity.app.logger.log(`${chalk.bold('(Query)')} SQL - Run ${chalk.bold(this.entity.name)}.${chalk.bold(this.id)}`);

		let resolvedParams;
		try {
			resolvedParams = this.resolveParams(params);
		} catch (e) {
			return this.handleBeforeActions(params, false)
				.then(() => Promise.reject(e))
				.catch(() => Promise.reject(e));
		}

		for (const param of this.params) {
			if (resolvedParams[param.name]) {
				if (typeof resolvedParams[param.name] == 'string') {
					if (param.type == 'date') {
						resolvedParams[param.name] = new Date(resolvedParams[param.name]);
					}
				}
			}
		}
		this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(resolvedParams)}`);
		this.entity.app.logger.log(` └── Query: ${this.query}\n`);

		return this.handleBeforeActions(params, true)
			.then(() =>
				this.entity.app.database.sequelize.query(this.query, {
					replacements: resolvedParams,
					type: QueryTypes.SELECT
				})
			).then(res =>
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

	toJson() {
		const res = {
			id: this.id,
			type: 'sql',
			opts: {
				params: this.paramsToJson(),
				values: this.values,
				query: this.query
			}
		};
		return res;
	}
}