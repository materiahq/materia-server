import { Query } from '../query';
import { Conditions } from './utils/conditions';
import chalk = require('chalk');

export class DeleteQuery extends Query {
	type: string;
	conditions: Conditions;

	constructor(entity, id, opts) {
		super(entity, id);
		this.type = 'delete';
		if ( ! opts ) {
			opts = {};
		}
		this.conditions = new Conditions(opts.conditions, this);
		this.discoverParams();
	}

	refresh() {}

	discoverParams() {
		this.params = [];
		this.params = this.params.concat(this.conditions.discoverParams());
	}

	run(params): Promise<any> {
		this.entity.app.logger.log(`${chalk.bold('(Query)')} Delete - Run ${chalk.bold(this.entity.name)}.${chalk.bold(this.id)}`);
		this.entity.app.logger.log(` └── Parameters: ${JSON.stringify(params)}\n`);

		let sequelizeCond;
		try {
			sequelizeCond = this.conditions.toSequelize(params, this.entity.name);
		} catch (e) {
			return this.handleBeforeActions(params, false)
				.then(() => Promise.reject(e))
				.catch(() => Promise.reject(e));
		}

		return this.handleBeforeActions(params, true)
			.then(() =>
				this.entity.model.destroy({ where: sequelizeCond })
			).then(res =>
				this.handleAfterActions(params, res, true)
					.then(() => res)
					.catch(e => res)
			).catch(e =>
				this.handleAfterActions(params, null, false)
					.then(() => Promise.reject(e))
					.catch(() => Promise.reject(e))
			);
	}

	toJson() {
		const json = {
			id: this.id,
			type: 'delete',
			opts: {
				conditions: this.conditions.toJson()
			}
		};
		return json;
	}
}