import chalk from 'chalk';

import { Query } from '../query';
import { Conditions } from './utils/conditions';
import { FindOptions } from 'sequelize/types';

export class FindOneQuery extends Query {
	opts: any;
	type: string;
	include: any;
	conditions: Conditions;
	orderBy: any;
	select: any;

	constructor(entity, id, opts) {
		super(entity, id);

		if ( ! opts) {
			opts = {};
		}
		this.opts = opts;
		this.type = 'findOne';
		this.include = opts.include || [];
		this.conditions = new Conditions(opts.conditions, this);

		this.orderBy = opts.orderBy || [];

		this.refresh();
	}

	discoverParams() {
		this.params = [];
		this.params = this.params.concat(this.conditions.discoverParams());
	}

	refresh() {
		this.select = this.opts.select;
		if ( ! this.select || this.select == [] ) {
			this.select = [];
			this.entity.fields.forEach((field) => {
				if (field.read) {
					this.select.push(field.name);
				}
			});
		}
		this.discoverParams();
	}

	constructSequelizeOpts(params, options) {
		const include = [];
		const includeNames = this.include;

		this.constructInclude(include, includeNames);

		let raw = false;
		if (options && options.raw) {
			raw = true;
		}

		const opts = {
			attributes: this.select,
			where: this.conditions.toSequelize(params, this.entity.name),
			include: include,
			raw: raw
		} as FindOptions;

		// Add conditions to opts recursively for included obj
		this.conditions.constructConditions(opts.include, params);

		opts.order = [];
		this.orderBy.forEach((order) => {
			let ascTxt = 'ASC';
			if (order.desc) {
				ascTxt = 'DESC';
			}
			(opts.order as Array<[string, string]>).push([order.field, ascTxt]);
		});
		return opts;
	}

	run(params, options): Promise<any> {
		this.entity.app.logger.log(`${chalk.bold('(Query)')} FindOne - Run ${chalk.bold(this.entity.name)}.${chalk.bold(this.id)}`);
		this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(params)}`);
		this.entity.app.logger.log(` └── Options: ${JSON.stringify(options)}\n`);
		let sequelizeOpts;
		try {
			sequelizeOpts = this.constructSequelizeOpts(params, options);
		} catch (e) {
			return this.handleBeforeActions(params, false)
				.then(() => Promise.reject(e))
				.catch(() => Promise.reject(e));
		}

		return this.handleBeforeActions(params, true)
			.then(() =>
				this.entity.model.findOne(sequelizeOpts)
			).then(res => {
				return this.handleAfterActions(params, res, true)
					.then(() => res)
					.catch(e => res);
			})
			.catch(e =>
				this.handleAfterActions(params, null, false)
					.then(() => Promise.reject(e))
					.catch(() => Promise.reject(e))
			);
	}

	toJson() {
		const res = {
			id: this.id,
			type: 'findOne',
			opts: {}
		} as any;

		if ( this.opts.include ) {
			res.opts.include = this.opts.include;
		}
		if ( this.opts.select ) {
			res.opts.select = this.opts.select;
		}
		if ( this.conditions.toJson() != []) {
			res.opts.conditions = this.conditions.toJson();
		}
		if (this.opts.orderBy) {
			res.opts.orderBy = this.opts.orderBy;
		}
		if (Object.keys(res.opts).length == 0) {
			delete res.opts;
		}

		return res;
	}
}