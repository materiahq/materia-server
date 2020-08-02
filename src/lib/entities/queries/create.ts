import { Query, QueryParamResolver } from '../query';
import chalk = require('chalk');

export class CreateQuery extends Query {
	type: string;
	opts: any;
	values: any;
	valuesType: any;

	constructor(entity, id, opts) {
		super(entity, id);

		this.type = 'create';
		this.opts = opts;
		this.entity = entity;
		this.refresh();
		this.discoverParams();
	}

	refresh() {
		if (this.opts) {
			if (this.opts.default) {
				this.params = [];
				this.values = {};
				const fields = this.entity.getWritableFields();
				fields.forEach(field => {
					this.values[field.name] = '=';
				});
			} else {
				this.values = this.opts.values;
			}
		}

		if (!this.values) {
			this.values = {};
		}
	}

	discoverParams() {
		this.valuesType = {};
		this.params = [];
		Object.keys(this.values).forEach(fieldName => {
			if (
				this.values[fieldName] &&
				this.values[fieldName].substr(0, 1) == '='
			) {
				this.valuesType[fieldName] = 'param';
				let paramName = fieldName;
				if (this.values[fieldName].length > 1) {
					paramName = this.values[fieldName].substr(1);
				}
				const field = this.entity.getField(fieldName);
				this.params.push({
					name: paramName,
					type: field.type,
					required: field.required,
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
	}

	resolveParams(params) {
		const res = {};
		for (const field in this.values) {
			if (field) {
				try {
					res[field] = QueryParamResolver.resolve(
						{ name: field, value: this.values[field] },
						params
					);
				} catch (e) {
					if (this.values[field].substr(0, 1) == '=') {
						const t = this.getParam(this.values[field].substr(1));
						if (t && t.required) {
							return Promise.reject(e);
						}
					}
				}
			}
		}
		for (const field of this.params) {
			if (field && !this.values[field.name]) {
				try {
					res[field.name] = QueryParamResolver.resolve(
						{ name: field.name, value: '=' },
						params
					);
				} catch (e) {
					if (field.required) {
						return Promise.reject(e);
					}
				}
			}
		}

		return Promise.resolve(res);
	}

	run(params, options): Promise<any> {
		this.entity.app.logger.log(
			`${chalk.bold('(Query)')} Create - Run ${chalk.bold(
				this.entity.name
			)}.${chalk.bold(this.id)}`
		);
		this.entity.app.logger.log(
			` └── Parameters: ${JSON.stringify(params)}\n`
		);

		const raw = options && options.raw;

		return this.resolveParams(params)
			.catch(e =>
				this.handleBeforeActions(params, false)
					.then(() => Promise.reject(e))
					.catch(() => Promise.reject(e))
			)
			.then(resolvedParams =>
				this.handleBeforeActions(resolvedParams, true)
					.then(() => resolvedParams)
			)
			.then(resolvedParams =>
				// Fix needed because passing Sequelize option {raw: true} not working on create query
				this.entity.model
					.create(resolvedParams)
					.then((resultEntity) => {
						const result = raw && resultEntity ? resultEntity.get({plain: true}) : resultEntity;
						return this.handleAfterActions(resolvedParams, result, true)
							.then(() => result)
							.catch(e => result);
					})
					.catch(e =>
						this.handleAfterActions(params, {}, false)
							.then(() => Promise.reject(e))
							.catch(() => Promise.reject(e))
					)
			);
	}

	toJson() {
		const res = {
			id: this.id,
			type: 'create',
			opts: {
				values: this.values
			}
		};
		return res;
	}
}
