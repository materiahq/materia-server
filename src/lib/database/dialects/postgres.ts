import { Sequelize, NOW } from 'sequelize';

import { AbstractDialect } from './abstract';
import { MateriaError } from '../../error';

export class PostgresDialect extends AbstractDialect {
	constructor(sequelize: Sequelize) {
		super(sequelize);
	}

	define(entityName, cols, defOptions) {
		for (const colName in cols) {
			if (cols[colName]) {
				const col = cols[colName];
				if (col.defaultValue === NOW && col.type === 'date') {
					col.defaultValue = Sequelize.literal('NOW');
				}
			}
		}
		return super.define(entityName, cols, defOptions);
	}

	addColumn(table, column_name, attributes): any {
		if (attributes.defaultValue === NOW) {
			attributes.defaultValue = Sequelize.fn('NOW');
		}
		return super.addColumn(table, column_name, attributes);
	}

	changeColumn(table, column_name, attributes): any {
		if (attributes.defaultValue === NOW) {
			attributes.defaultValue = Sequelize.fn('NOW');
		}
		return super.changeColumn(table, column_name, attributes);
	}

	showTables(): Promise<any> {
		const promises = [];
		return this.sequelize.getQueryInterface().showAllTables().then((tables: Array<string>) => {
			for (const table of tables) {
				const queryInterface = this.sequelize.getQueryInterface();
				// let qg = this.sequelize.getQueryInterface().QueryGenerator
				const infoQuery = queryInterface.describeTable(table);
				const indexQuery = queryInterface.showIndex(table);
				const fkQuery = this._getFKs(table);
				// let fkQuery = queryInterface.getForeignKeysForTables([table] )
				// getForeignKeysForTables not working:
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

							// don't trust describeTable (https://github.com/sequelize/sequelize/issues/5756)
							info[name].primaryKey = false;

							fields.push(info[name]);
						}
					}

					for (const field of fields) {
						for (const index of indexes) {
							for (const ind of index.fields) {
								if (ind.attribute == field.name) {
									field.primaryKey = field.primaryKey || index.primary;
									if (index.fields.length > 1) {
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
								field.fk = {
									entity: fk.table,
									field: fk.to
								};
								field.onUpdate = fk.on_update && fk.on_update.toUpperCase();
								field.onDelete = fk.on_delete && fk.on_delete.toUpperCase();
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

	// TODO: remove and use abstract getIndices instead of postgres' one ?
	/*getIndices(table) {
		let query = this.sequelize.getQueryInterface().QueryGenerator.showIndexesQuery(table)
		return this.sequelize.query(query).then((res) => {
			let fields = {}
			for (let index of res[0]) {
				let inds = index.indkey.split(' ');
				let column_names = index.column_names.substr(1, index.column_names.length - 2).split(',')
				index.fields = []
				for (let ind of inds) {
					let name = column_names[index.column_indexes.indexOf(parseInt(ind))]
					index.fields.push(name)
				}
				for (let ind of inds) {
					let name = column_names[index.column_indexes.indexOf(parseInt(ind))]
					fields[name] = fields[name] || []
					fields[name].push(index)
				}
			}
			return Promise.resolve(fields)
		})
	}*/
	// -----

	addConstraint(table, constraint) {
		const constraint_type = (constraint.type == 'primary') ? 'PRIMARY KEY' : 'UNIQUE';
		if (constraint.type == 'primary') {
			constraint.name = table + '_pkey';
		} else if ( ! constraint.name) {
			constraint.name = constraint.fields.join('_') + '_' + table + '_key';
		}
		return this.sequelize.query(
			`ALTER TABLE "${table}" ADD CONSTRAINT "${constraint.name}" ${constraint_type} ("${constraint.fields.join('", "')}")`
		);
	}

	dropConstraint(table, constraint): any {
		const queryInterface = this.sequelize.getQueryInterface();
		if (constraint.name) {
			return this.sequelize.query(
				`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint.name}"`
			).then(() => {
				return this.sequelize.getQueryInterface().removeIndex(
					table, constraint.name
				);
			});
		} else if (constraint.field) {
			if (constraint.type == 'references') {
				return this._getFKs(table).then((fks) => {
					for (const fk of fks) {
						if (fk.from == constraint.field) {
							return this.sequelize.query(
								`ALTER TABLE "${table}" DROP CONSTRAINT "${fk.constraint_name}"`
							);
						}
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
									`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${i.name}"`
								).then(() => {
									return queryInterface.removeIndex(
										table, i.name
									);
								});
							});
						})(index);
					}
				}
				return p;
			});
		}
	}

	castColumnType(table, column_name, old_type, type): any {
		let queryCast;

		if (type == 'number') {
			type = 'integer';
			if (old_type == 'text' || ! old_type) {
				queryCast = 'trim(' + column_name + ')::integer';
			} else if (old_type == 'date') {
				queryCast = 'extract(epoch from ' + column_name + ')::integer';
			}
		} else if (type == 'float') {
			type = 'double precision';
			if (old_type == 'text' || ! old_type) {
				queryCast = '(trim(' + column_name + ')::double precision)';
			} else if (old_type == 'date') {
				queryCast = '(extract(epoch from ' + column_name + ')::double precision)';
			}
		} else if (type == 'boolean') {
			if (old_type == 'text' || ! old_type) {
				queryCast = 'CASE lower(' + column_name +
				`) WHEN 'false' THEN FALSE WHEN '0' THEN FALSE WHEN 'f' THEN FALSE WHEN 'n' THEN FALSE WHEN 'no' THEN FALSE ELSE TRUE END`;
			} else if (old_type == 'number' || old_type == 'float') {
				queryCast = 'CASE ' + column_name + ' WHEN 0 THEN FALSE ELSE TRUE END';
			}
		} else if (type == 'date') {
			type = 'timestamp with time zone';
			if (old_type == 'text' || ! old_type) {
				queryCast = 'to_timestamp(trim(' + column_name + ')::integer)';
			} else if (old_type == 'number' || old_type == 'float') {
				queryCast = 'to_timestamp(' + column_name + ')';
			}
		} else if (type == 'text') {
			if (old_type == 'date') {
				queryCast = 'extract(epoch from ' + column_name + ')';
			}
		}

		if (queryCast) {
			return this.sequelize.query(
				`ALTER TABLE ${table} ALTER COLUMN "${column_name}" TYPE ${type} USING ${queryCast}`
			).then(() => {
				return true;
			});
		} else {
			return Promise.resolve(false);
		}
	}
}