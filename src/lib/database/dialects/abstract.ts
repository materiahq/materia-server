import { Sequelize } from 'sequelize';

import { MateriaError } from '../../error';

export class AbstractDialect {
	sequelize: Sequelize;

	constructor(sequelize: Sequelize) {
		this.sequelize = sequelize;
	}

	showTables(): any {
		return Promise.reject(new MateriaError('Not implemented method in dialect'));
	}

	getIndices(table): Promise<any> {
		return this.sequelize.getQueryInterface().showIndex(table).then((res: Array<any>) => {
			const fields = {};
			for (const index of res) {
				for (const field of index.fields) {
					fields[field.attribute] = fields[field.attribute] || [];
					fields[field.attribute].push(index);
				}
			}
			return Promise.resolve(fields);
		});
	}

	_getFKs(table): Promise<any> {
		const qg: any = this.sequelize.getQueryInterface().QueryGenerator;
		const query = qg.getForeignKeysQuery(table, 'public');
		return this.sequelize.query(query, {raw: true}).then((fks: any[]) => {
			for (const fk of fks) {
				for (const k of ['constraint_name', 'name', 'table', 'from', 'to']) {
					if (fk[k] && (fk[k][0] == '"' || fk[k][0] == "'")) {
						fk[k] = fk[k].substr(1, fk[k].length - 2);
					}
				}
			}
			return fks;
		});
	}

	getFKs(table): Promise<any> {
		return this._getFKs(table).then((res) => {
			const fields = {};
			for (const fk of res) {
				fields[fk.from] = fk;
			}
			return Promise.resolve(fields);
		});
	}

	addColumn(table, column_name, attributes): Promise<any> {
		return this.sequelize.getQueryInterface().addColumn(
			table, column_name, attributes
		);
	}

	changeColumn(table, column_name, attributes): any {
		return this.sequelize.getQueryInterface().changeColumn(
			table, column_name, attributes
		);
	}

	removeColumn(table, column_name): Promise<any> {
		return this.sequelize.getQueryInterface().removeColumn(table, column_name);
	}

	renameColumn(table, column_name, column_new_name): Promise<any> {
		return this.sequelize.getQueryInterface().renameColumn(table, column_name, column_new_name);
	}

	dropConstraint(table, constraint): any {
		return Promise.reject(new MateriaError('Not implemented method in dialect'));
	}

	addConstraint(table, constraint): any {
		return Promise.reject(new MateriaError('Not implemented method in dialect'));
	}

	castColumnType(table, column_name, old_type, type): Promise<any> {
		return Promise.resolve(false);
	}

	authenticate(): Promise<any> {
		return this.sequelize.authenticate();
	}

	define(entityName, cols, defOptions) {
		return this.sequelize.define(entityName, cols, defOptions);
	}
}