import * as Sequelize from 'sequelize';

import { AbstractDialect } from './abstract';
import { MateriaError } from '../../error';

export class SqliteDialect extends AbstractDialect {
	constructor(sequelize) {
		super(sequelize);
	}

	define(entityName, cols, defOptions) {
		for (const colName in cols) {
			if (cols[colName]) {
				const col = cols[colName];
				if (col && col.defaultValue && col.defaultValue === Sequelize.NOW && col.type === 'date') {
					col.defaultValue = Sequelize.literal('CURRENT_TIMESTAMP');
				}
			}
		}
		return super.define(entityName, cols, defOptions);
	}

	showTables() {
		const promises = [];
		return this.sequelize.getQueryInterface().showAllTables().then((tables: Array<string>) => {
			tables.forEach(table => {
				const queryInterface = this.sequelize.getQueryInterface();
				const qg = this.sequelize.getQueryInterface().QueryGenerator;
				const infoQuery = queryInterface.describeTable(table);
				const indexQuery = queryInterface.showIndex(table);
				const fkQuery = qg.getForeignKeysQuery(table, 'public');
				// let fkQuery = queryInterface.getForeignKeysForTables([table] )
				// getForeignKeysForTables not working:
				// https://github.com/sequelize/sequelize/issues/5748

				const aiQuery =
					this.sequelize.query(
						`SELECT 1 as name FROM sqlite_master WHERE type = 'table' AND name = ? AND sql LIKE '%AUTOINCREMENT%'`,
						{ replacements: [table], raw: true, plain: true
					});
				promises.push(infoQuery);
				promises.push(indexQuery);
				// promises.push(fkQuery)
				promises.push(this.sequelize.query(fkQuery));
				promises.push(aiQuery);
			});
			return Promise.all(promises).then((result) => {
				const res = {};

				tables.forEach((table, i) => {
					const info = result[i * 4];
					const indexes = result[i * 4 + 1];
					const fks = result[i * 4 + 2];
					const hasAi = result[i * 4 + 3][0];

					const fields = [];
					for (const name in info) {
						if (info[name]) {
							info[name].name = name;
							fields.push(info[name]);
						}
					}

					for (const field of fields) {
						for (const index of indexes) {
							for (const ind of index.fields) {
								if (ind.attribute == field.name) {
									field.primaryKey = field.primaryKey || index.primary || index.origin == 'pk';
									if (index.fields.length > 1 || index.origin == 'c') {
										field.unique = index.name;
									} else {
										field.unique = field.unique || index.unique;
									}
								}
							}
						}
						if (field.primaryKey) {
							if (hasAi) {
								field.autoIncrement = true;
							}
							if (field.type == 'INTEGER') {
								field.allowNull = false;
							}
						}
						if (field.type == 'TINYINT(1)') {
							field.type = ['BOOLEAN', 'TINYINT(1)'];
							if (field.defaultValue === 0) {
								field.defaultValue = [0, 'false'];
							}
							if (field.defaultValue === 1) {
								field.defaultValue = [1, 'true'];
							}
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
							}
						}

						field.autoIncrement = field.autoIncrement || false; // not undefined
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

	_backupTmpTable(table) {
		const queryInterface = this.sequelize.getQueryInterface();
		const qg = this.sequelize.getQueryInterface().QueryGenerator;
		const infoQuery = queryInterface.describeTable(table);
		const indexQuery = queryInterface.showIndex(table);
		const fkQuery = this.sequelize.query(qg.getForeignKeysQuery(table, 'public'));
		const aiQuery = this.sequelize.query(
			`SELECT 1 as name FROM sqlite_master WHERE type = 'table' AND name = ? AND sql LIKE '%AUTOINCREMENT%'`,
			{ replacements: [table], raw: true, plain: true }
		);

		const promises = [infoQuery, indexQuery, fkQuery, aiQuery];
		return Promise.all(promises).then((results) => {
			const fields = results[0];
			const indexes = results[1];
			const fks = results[2];
			const hasAi = results[3][0];

			const uniqueKeys = [];

			for (const field_name in fields) {
				if (fields[field_name]) {
					const field = fields[field_name];
					for (const index of indexes) {
						for (const ind of index.fields) {
							if (ind.attribute == field_name) {
								field.primaryKey = field.primaryKey || index.primary || index.origin == 'pk';
								if (index.fields.length == 1) {
									field.unique = field.unique || index.unique;
								}
							}
						}
					}
					if (field.primaryKey) {
						if (hasAi) {
							field.autoIncrement = true;
						}
						if (field.type == 'INTEGER') {
							field.allowNull = false;
						}
					}
					for (const fk of fks) {
						if (field_name == fk.from) {
							if (fk.table.substr(0, 1) == '"') {
								fk.table = fk.table.substr(1, fk.table.length - 2);
							}
							if (fk.to.substr(0, 1) == '"') {
								fk.to = fk.to.substr(1, fk.to.length - 2);
							}
							field.references = {
								model: fk.table,
								key: fk.to
							};
							field.onUpdate = fk.on_update && fk.on_update.toUpperCase();
							field.onDelete = fk.on_delete && fk.on_delete.toUpperCase();
						}
					}
				}
			}

			for (const index of indexes) {
				if (index.fields.length > 1) {
					const uniqueFields = [];
					for (const ind of index.fields) {
						uniqueFields.push(ind.attribute);
					}
					uniqueKeys.push({fields: uniqueFields, name: index.name, origin: index.origin, type: 'UNIQUE'});
				}
			}

			// keep uniqueKeys / fields
			const tableData = {
				attributes: fields,
				options: {uniqueKeys: uniqueKeys},
				done: null,
				rename: null
			};

			const quotedTableName = qg.quoteTable(table);
			const quotedBackupTableName = qg.quoteTable(table + '_materia_backup');

			tableData.done = () => {
				const attributeNames = Object.keys(tableData.attributes).map(attr => qg.quoteIdentifier(attr)).join(', ');

				let attributesNameImport;
				if (tableData.rename) {
					attributesNameImport = Object.keys(tableData.attributes).map((attr) => {
						if (attr == tableData.rename.after) {
							return qg.quoteIdentifier(tableData.rename.before) + ' AS ' + qg.quoteIdentifier(attr);
						} else {
							return qg.quoteIdentifier(attr);
						}
					}).join(', ');
				} else {
					attributesNameImport = attributeNames;
				}

				const attributesSql = qg.attributesToSQL(tableData.attributes);

				const subQueries = [
					() => this.sequelize.transaction(t => {
						const transactionQueries = [
							`PRAGMA foreign_keys = 0;`,
							`PRAGMA defer_foreign_keys = 1;`,
							`DROP TABLE IF EXISTS ${quotedBackupTableName};`,
							`CREATE TEMPORARY TABLE ${quotedBackupTableName} AS SELECT * FROM ${quotedTableName};`,
							`DROP TABLE ${quotedTableName};`,
							qg.createTableQuery(table, attributesSql, tableData.options),
							`INSERT INTO ${quotedTableName} SELECT ${attributesNameImport} FROM ${quotedBackupTableName};`,
							`DROP TABLE ${quotedBackupTableName};`
						].map(query => {
							return () => this.sequelize.query(query, {raw: true, transaction: t});
						});
						let promise = Promise.resolve();
						for (const query of transactionQueries) {
							promise = promise.then(() => {
								return query();
							});
						}
						return promise;
					})
				];

				for (const uniq of tableData.options.uniqueKeys) {
					if (uniq.origin == 'c') {
						subQueries.push(() => queryInterface.addIndex(table, uniq));
					}
				}

				let p = Promise.resolve();
				for (const query of subQueries) {
					p = p.then(() => {
						return query();
					});
				}
				return p;
			};

			return Promise.resolve(tableData);
		});
	}

	addColumn(table, column_name, attributes): any {
		if (attributes.defaultValue === Sequelize.NOW) {
			attributes.defaultValue = new Date();
		}
		if (attributes.references && attributes.allowNull === false) {
			// Adding a not null reference:
			// http://stackoverflow.com/questions/24524153/adding-not-null-column-to-sqlite-table-with-references/24524935#24524935
			const queries = [];
			queries.push(this.sequelize.query('PRAGMA foreign_keys = 0;'));
			queries.push(super.addColumn(table, column_name, attributes));
			queries.push(this.sequelize.query('PRAGMA foreign_keys = 1;'));

			return queries.reduce((p, f) => p.then(f), Promise.resolve());
		}
		return super.addColumn(table, column_name, attributes);
	}

	changeColumn(table, column_name, attributes) {
		return this._backupTmpTable(table).then((tableData) => {
			for (const k in attributes) {
				if (attributes[k]) {
					tableData.attributes[column_name][k] = attributes[k];
				}
			}

			tableData.attributes[column_name].type = this.sequelize.normalizeDataType(tableData.attributes[column_name].type);
			if (tableData.attributes[column_name].default === false) {
				delete tableData.attributes[column_name].defaultValue;
			}
			return tableData.done();
		});
	}

	removeColumn(table, column_name): any {
		return this._backupTmpTable(table).then((tableData) => {
			delete tableData.attributes[column_name];
			return tableData.done();
		});
	}

	renameColumn(table, column_name, column_new_name): any {
		return this._backupTmpTable(table).then((tableData) => {
			tableData.attributes[column_new_name] = tableData.attributes[column_name];
			delete tableData.attributes[column_name];
			tableData.rename = {before: column_name, after: column_new_name};
			return tableData.done();
		});
	}

	addConstraint(table, constraint) {
		return this._backupTmpTable(table).then((tableData) => {

			if (constraint.type == 'primary') {
				for (const field of constraint.fields) {
					tableData.attributes[field].primaryKey = true;
				}
			} else if (constraint.type == 'unique') {
				if (constraint.fields.length == 1) {
					tableData.attributes[constraint.fields[0]].unique = true;
				} else {
					tableData.options.uniqueKeys.push({
						fields: constraint.fields,
						name: constraint.name,
						type: 'UNIQUE',
						origin: 'c'
					});
				}
			}

			return tableData.done();
		});
	}

	dropConstraint(table, constraint) {
		return this._backupTmpTable(table).then((tableData) => {

			let changed = false;

			if (constraint.name) {
				let uniqGroupFields;

				// drop custom index and keep group info
				tableData.options.uniqueKeys.forEach((uniq, j) => {
					if ( ! changed && uniq.indexName == constraint.name && uniq.origin == 'c') {
						tableData.options.uniqueKeys.splice(j, 1);
						uniqGroupFields = uniq.fields.join(',');
						changed = true;
					}
				});

				// drop same index created by unique or primary
				tableData.options.uniqueKeys.forEach((uniq, j) => {
					if ( ! changed && uniqGroupFields == uniq.fields.join(',') && uniq.origin != 'c' ) {
						tableData.options.uniqueKeys.splice(j, 1);
						changed = true;
					}
				});
			} else if (constraint.field) {

				if (constraint.type == 'unique') {
					// drop field constraint from groups
					tableData.options.uniqueKeys.forEach((uniq, j) => {
						for (const i in uniq.fields) {
							if (uniq.fields[i]) {
								const field = uniq.fields[i];
								if (field == constraint.field) {
									uniq.fields.splice(i, 1);
									changed = true;
									break;
								}
							}
						}
						if (uniq.fields.length == 0) {
							tableData.options.uniqueKeys.splice(j, 1);
						}
					});
				}

				// drop constraint in field
				for (const field_name in tableData.attributes) {
					if (tableData.attributes[field_name]) {
						const field = tableData.attributes[field_name];
						if (constraint.type == 'primary') {
							if (field.primaryKey || field.unique) {
								field.primaryKey = false;
								field.unique = false;
								changed = true;
							}
						} else if (constraint.field == field_name) {
							if (constraint.type == 'unique' && field.unique) {
								field.unique = false;
								changed = true;
							} else if (constraint.type == 'references' && field.references) {
								delete field.references;
								changed = true;
							}
						}
					}
				}
			}

			if ( ! changed) {
				return Promise.resolve();
			}
			return tableData.done();
		});
	}

	authenticate() {
		return this.sequelize.authenticate().then(() => {
			this.sequelize.query('PRAGMA foreign_keys = 1;', {raw: true});
		});
	}
}