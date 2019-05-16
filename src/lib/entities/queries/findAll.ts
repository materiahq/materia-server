import chalk from 'chalk';
import * as Bluebird from 'bluebird';
import { IFindAllOptions, IQueryOrdering } from '@materia/interfaces';
import { FindOptions } from 'sequelize';

import { Query, QueryParamResolver } from '../query';
import { Conditions } from './utils/conditions';

export class FindAllQuery extends Query {
	opts: IFindAllOptions;
	type: string;
	conditions: Conditions;
	include: any;
	limit: number|string;
	page: number|string;
	offset: number|string;
	orderBy: IQueryOrdering[];
	select: string[];

	constructor(entity, id, opts?: IFindAllOptions) {
		super(entity, id);

		if ( ! opts) {
			opts = {};
		}

		this.opts = opts;
		this.type = 'findAll';
		this.conditions = new Conditions(opts.conditions, this);
		this.include = opts.include || [];

		this.limit = opts.limit || '=';

		if ( ! opts.offset && opts.page) {
			this.page = opts.page;
			this.offset = null;
		} else {
			this.offset = opts.offset || 0;
			this.page = '=';
		}

		this.orderBy = opts.orderBy || [];
		this.refresh();
		this.discoverParams();
	}

	refresh() {
		this.select = this.opts.select;
		if ( ! this.select || this.select == []) {
			this.select = [];
			this.entity.fields.forEach((field) => {
				if (field.read) {
					this.select.push(field.name);
				}
			});
		}
	}

	discoverParams() {
		this.params = [];
		this.params = this.params.concat(this.conditions.discoverParams());

		this.discoverParam('limit', 'number');
		this.discoverParam('page', 'number');
		this.discoverParam('offset', 'number');
	}

	discoverParam(param: string, type: string, required?: boolean) {
		if ( ! required ) {
			required = false;
		}
		if (this[param] && typeof this[param] == 'string' && this[param].length > 0 && this[param][0] == '=') {
			let paramName = param;
			if (this[param].length > 1) {
				paramName = this[param].substr(1);
			}
			this.params.push({
				name: paramName,
				required: required,
				type: type,
				component: 'input'
			});
		}
	}

	constructSequelizeOpts(params, options?): FindOptions {
		const pagination = this.getPagination(params);

		options = options || {};

		let raw = false;
		if (options.raw) {
			raw = true;
		}
		const sequelizeOpts = {
			attributes: this.select,
			where: this.conditions.toSequelize(params, this.entity.name),
			raw: raw
		} as FindOptions;

		if (this.entity.getPK().length) {
			const include = [];
			const includeNames = this.include;

			this.constructInclude(include, includeNames);
			sequelizeOpts.include = include;
			// Add conditions to opts recursively for included obj
			this.conditions.constructConditions(sequelizeOpts.include, params);
		}


		if (pagination) {
			sequelizeOpts.offset = pagination.offset;
			sequelizeOpts.limit = pagination.limit;
		}

		let orderBy = [];
		if (this.orderBy.length) {
			this.orderBy.forEach(queryOrdering => {
				let ascText = 'ASC';
				if (queryOrdering.desc) {
					ascText = 'DESC';
				}
				orderBy.push([queryOrdering.field, ascText]);
			});
		}
		if (params && params.orderBy) {
			orderBy = [];
			params.orderBy.forEach((order) => {
				let ascTxt = 'ASC';
				if (order.desc) {
					ascTxt = 'DESC';
				}
				orderBy.push([order.field, ascTxt]);
			});
		}
		if (orderBy.length) {
			sequelizeOpts.order = orderBy;
		}
		return sequelizeOpts;
	}

	run(params, options): Promise<any> {
		if ( ! options || ! options.silent ) {
			this.entity.app.logger.log(`${chalk.bold('(Query)')} FindAll - Run ${chalk.bold(this.entity.name)}.${chalk.bold(this.id)}`);
			this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(params)}`);
			this.entity.app.logger.log(` └── Options: ${JSON.stringify(options)}`);
		}
		let sequelizeOpts;
		try {
			sequelizeOpts = this.constructSequelizeOpts(params, options);
		} catch (e) {
			this.entity.app.logger.error(e);
			return this.handleBeforeActions(params, false)
				.then(() => Promise.reject(e))
				.catch(() => Promise.reject(e));
		}

		return this.handleBeforeActions(params, true)
			.then(() => {
				return this._run(sequelizeOpts, options);
			})
			.then(res =>
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

	getPagination(params) {
		let limit, offset;

		limit = this._paramResolver('limit', this.limit, params, 30);

		if (this.page) {
			const page = this._paramResolver('page', this.page, params, 1);
			offset = (page - 1) * limit;
		} else {
			offset = this._paramResolver('offset', this.offset, params, 0);
		}

		return {
			limit: limit,
			offset: offset
		};
	}

	toJson() {
		const res = {
			id: this.id,
			type: 'findAll',
			opts: {} as IFindAllOptions
		};

		if (this.opts.select) {
			res.opts.select = this.opts.select;
		}
		if (this.conditions.toJson() != []) {
			res.opts.conditions = this.conditions.toJson();
		}
		if (this.opts.include) {
			res.opts.include = this.opts.include;
		}
		if (this.opts.offset) {
			res.opts.offset = this.opts.offset;
		}
		if (this.opts.limit) {
			res.opts.limit = this.opts.limit;
		}
		if (this.opts.page) {
			res.opts.page = this.opts.page;
		}
		if (this.opts.orderBy) {
			res.opts.orderBy = this.opts.orderBy;
		}
		if (Object.keys(res.opts).length == 0) {
			delete res.opts;
		}
		return res;
	}

	private _paramResolver(name, value, params, defaultValue) {
		let tmp;
		try {
			tmp = QueryParamResolver.resolve({ name: name, value: value }, params);
			if ( ! tmp ) {
				throw new Error('error');
			}
		} catch (e) {
			tmp = defaultValue;
		}
		return tmp;
	}

	private _run(sequelizeOpts: FindOptions, options): Bluebird<any> {
		return this.entity.model.findAndCountAll(sequelizeOpts).then(res => {
			if ( ! options || ! options.silent ) {
				this.entity.app.logger.log(` └── ${chalk.green.bold('OK')}\n`);
			}
			let result: any = {
				data: res.rows,
				count: res.count
			};
			if (sequelizeOpts.limit && sequelizeOpts.offset != null) {
				result = {
					count: result.count,
					pagination: {
						offset: sequelizeOpts.offset,
						page: (sequelizeOpts.offset / sequelizeOpts.limit) + 1,
						limit: sequelizeOpts.limit
					},
					data: res.rows
				};
			}
			if ( ! options || ! options.raw) {
				result.toJSON = () => {
					const data = result.data.map(elt => {
						if (elt.toJSON) {
							return elt.toJSON();
						} else {
							return elt;
						}
					});
					let jsonResult: any = {
						count: res.count && typeof res.count === 'number' ? res.count : data.length,
						data: data
					};
					if (sequelizeOpts.limit && sequelizeOpts.offset != null) {
						jsonResult = {
							count: jsonResult.count,
							pagination: {
								offset: sequelizeOpts.offset,
								page: (sequelizeOpts.offset / sequelizeOpts.limit) + 1,
								limit: sequelizeOpts.limit
							},
							data: data
						};
					}
					return jsonResult;
				};
			}

			return result;
		});
	}
}