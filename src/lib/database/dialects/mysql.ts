import * as Sequelize from 'sequelize';
import * as Bluebird from 'bluebird';

import { AbstractDialect } from './abstract';
import { MateriaError } from '../../error';

export class MysqlDialect extends AbstractDialect {
	constructor(sequelize) {
		super(sequelize);
	}

	define(entityName, cols, defOptions) {
		for (const colName in cols) {
			if (cols[colName]) {
				const col = cols[colName];
				if (col && col.defaultValue && col.defaultValue === Sequelize.NOW && col.type === 'date') {
					col.defaultValue = Sequelize.fn('NOW');
				}
			}
		}
		return super.define(entityName, cols, defOptions);
	}

	addColumn(table, column_name, attributes): any {
		if (attributes.defaultValue === Sequelize.NOW) {
			attributes.defaultValue = Sequelize.fn('NOW');
		}
		return super.addColumn(table, column_name, attributes);
	}

	changeColumn(table, column_name, attributes): any {
		if (attributes.defaultValue === Sequelize.NOW) {
			attributes.defaultValue = Sequelize.fn('NOW');
		}
		return super.changeColumn(table, column_name, attributes);
	}

	private _describeTable(table) {
		const qg = this.sequelize.getQueryInterface().QueryGenerator;
		const sql = qg.describeTableQuery(table);
		return this.sequelize.query(sql, {raw: true}).then((desc) => {
			const data = desc[0];
			const result = {};

			const enumRegex = /^enum/i;
			for (const _result of data) {
				result[_result.Field] = {
					type: enumRegex.test(_result.Type) ? _result.Type.replace(enumRegex, 'ENUM') : _result.Type.toUpperCase(),
					allowNull: (_result.Null === 'YES'),
					defaultValue: _result.Default,
					primaryKey: _result.Key === 'PRI',
					autoIncrement: _result.Extra === 'auto_increment'
				};
			}

			return result;
		});
	}

	_getFKs(table): Bluebird<any> {
		const query =
			'SELECT INFORMATION_SCHEMA.KEY_COLUMN_USAGE.CONSTRAINT_NAME as `constraint_name`,' +
				'INFORMATION_SCHEMA.KEY_COLUMN_USAGE.COLUMN_NAME as `from`,' +
				'INFORMATION_SCHEMA.KEY_COLUMN_USAGE.REFERENCED_TABLE_NAME as `table`,' +
				'INFORMATION_SCHEMA.KEY_COLUMN_USAGE.REFERENCED_COLUMN_NAME as `to`,' +
				'INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS.UPDATE_RULE as `on_update`,' +
				'INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS.DELETE_RULE as `on_delete`' +
			'FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS ' +
				'ON INFORMATION_SCHEMA.KEY_COLUMN_USAGE.CONSTRAINT_NAME = INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS.CONSTRAINT_NAME ' +
				"WHERE INFORMATION_SCHEMA.KEY_COLUMN_USAGE.TABLE_NAME = '" + table + "' " +
				'AND INFORMATION_SCHEMA.KEY_COLUMN_USAGE.REFERENCED_TABLE_NAME IS NOT NULL';
		return this.sequelize.query(query, {raw: true}).then((res) => {
			return Promise.resolve(res[0]);
		});
	}

	getFKs(table) {
		return this._getFKs(table).then((res) => {
			const fields = {};
			for (const fk of res) {
				fields[fk.from] = fk;
			}
			return Promise.resolve(fields);
		});
	}

	showTables(): Bluebird<any> {
		const promises = [];
		return this.sequelize.getQueryInterface().showAllTables().then((tables: Array<string>) => {
			for (const table of tables) {
				const queryInterface = this.sequelize.getQueryInterface();
				// let qg = this.sequelize.getQueryInterface().QueryGenerator
				const infoQuery = this._describeTable(table);
				const indexQuery = queryInterface.showIndex(table);
				const fkQuery = this._getFKs(table);
				// let fkQuery = qg.getForeignKeysQuery(table)
				// let fkQuery = queryInterface.getForeignKeysForTables([table])
				// neither getForeignKeysQuery nor getForeignKeysForTables are working for mysql:
				// https://github.com/sequelize/sequelize/issues/5748
				promises.push(infoQuery);
				promises.push(indexQuery);
				promises.push(fkQuery);
			}
			return Promise.all(promises).then((result) => {
				const res = {};

				tables.forEach((table, i) => {
					const info = result[i * 3];
					const indexes = result[i * 3 + 1];
					const fks = result[i * 3 + 2];

					const fields = [];
					for (const name in info) {
						if (info[name]) {
							info[name].name = name;

							// Do not trust describe but only indices
							info[name].primaryKey = false;

							fields.push(info[name]);
						}
					}

					for (const field of fields) {
						for (const index of indexes) {
							for (const ind of index.fields) {
								if (ind.attribute == field.name) {
									field.primaryKey = field.primaryKey || index.primary;
									if ( ! index.primary && index.fields.length > 1) {
										field.unique = index.name;
									} else {
										field.unique = field.unique || index.unique;
									}
								}
							}
						}
						if (field.type == 'JSON') {
							field.type = ['JSON', 'TEXT'];
						}
						for (const fk of fks) {
							if (field.name == fk.from) {
								if (fk.table.substr(0, 1) == '"') {
									fk.table = fk.table.substr(1, fk.table.length - 2);
								}
								if (fk.to.substr(0, 1) == '"') {
									fk.to = fk.to.substr(1, fk.to.length - 2);
								}
								field.fk = {
									entity: fk.table,
									field: fk.to
								};
								field.onUpdate = fk.on_update && fk.on_update.toUpperCase();
								field.onDelete = fk.on_delete && fk.on_delete.toUpperCase();
								if (field.onDelete == 'RESTRICT' || field.onDelete == 'NO ACTION') {
									field.onDelete = ['RESTRICT', 'NO ACTION'];
								}
							}
						}
					}
					res[table] = fields;
				});
				return res;
			}).catch((e) => {
				const err = new MateriaError('Error when scanning database');
				err['originalError'] = e;
				throw err;
			});
		});
	}

	addConstraint(table, constraint): Bluebird<any> {
		if (constraint.type != 'primary' && ! constraint.name) {
			constraint.name = constraint.fields.join('_') + '_' + table + '_key';
		}
		const constraint_sql = (constraint.type == 'primary') ? 'PRIMARY KEY' : `CONSTRAINT ${constraint.name} UNIQUE`;
		return this.sequelize.query(
			`ALTER TABLE ${table} ADD ${constraint_sql} (${constraint.fields.join(', ')})`
		);
	}

	dropConstraint(table, constraint): Bluebird<any> {
		if (constraint.name) {
			return this.sequelize.getQueryInterface().showIndex(table).then((res: Array<any>) => {
				for (const index of res) {
					if (index.name == constraint.name) {
						return this.sequelize.getQueryInterface().removeIndex(
							table, constraint.name
						);
					}
				}
				return Promise.resolve();
			});
		} else if (constraint.type == 'primary') {
			return this.sequelize.query(
				`ALTER TABLE ${table} DROP PRIMARY KEY`
			);
		} else if (constraint.field) {
			if (constraint.type == 'references') {
				return this.getFKs(table).then((fks) => {
					if (fks[constraint.field]) {
						return this.sequelize.query(
							`ALTER TABLE ${table} DROP FOREIGN KEY ` + fks[constraint.field].constraint_name
						);
					}
				});
			}
			return this.getIndices(table).then((fields) => {
				if ( ! fields[constraint.field]) {
					return Promise.resolve();
				}
				let p = Promise.resolve();
				for (const index of fields[constraint.field]) {
					if (index.unique) {
						 ((i) => {
							p = p.then(() => {
								return this.sequelize.query(
									`ALTER TABLE ${table} DROP INDEX ${i.name}`
								);
							});
						})(index);
					}
				}
				return p;
			});
		}
	}
}