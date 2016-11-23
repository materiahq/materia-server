import * as Sequelize from 'sequelize'

import { Database } from '../database'

import { PostgresDialect } from './dialects/postgres'
import { MysqlDialect } from './dialects/mysql'
import { SqliteDialect } from './dialects/sqlite'

var dialectClasses = {
	postgres: PostgresDialect,
	sqlite: SqliteDialect,
	mysql: MysqlDialect
}

const typemap = {
	'int': 'number',
	'integer': 'number',
	'tinyint': 'number',
	'smallint': 'number',
	'mediumint': 'number',
	'bigint': 'number',
	'unsigned big int': 'number',
	'int2': 'number',
	'int8': 'number',
	'serial': 'number',
	'bigserial': 'number',

	'character': 'text',
	'varchar': 'text',
	'character varying': 'text',
	'varying character': 'text',
	'nchar': 'text',
	'native character': 'text',
	'nvarchar': 'text',
	'text': 'text',
	'clob': 'text',
	'json': 'text',

	//'blob': 'blob'

	'real': 'float',
	'double': 'float',
	'double precision': 'float',
	'float': 'float',
	'numeric': 'float',
	'decimal': 'float',

	'date': 'date',
	'datetime': 'date',
	'time with time zone': 'date',
	'time without time zone': 'date',
	'timestamp with time zone': 'date',
	'timestamp without time zone': 'date',

	'boolean': 'boolean',
}

const sequelize_typemap = {
	'date': Sequelize.DATE,
	'number': Sequelize.INTEGER,
	'boolean': Sequelize.BOOLEAN,
	'float': Sequelize.FLOAT,
	// others are Sequelize.TEXT
}

/**
 * @class DatabaseInterface
 * @classdesc
 * Contains methods to interact with the database
 */
export class DatabaseInterface {
	dialectTools: any

	constructor(private database: Database) {}

	hasDialect(dialect) {
		return !! dialectClasses[dialect]
	}

	setDialect(dialect) {
		this.dialectTools = new dialectClasses[dialect](this.database.sequelize)
	}

	define(entity) {
		let defOptions = {
			freezeTableName: true,
			timestamps: false
		}

		let cols = {}
		entity.getFields().forEach((field) => {
			cols[field.name] = this.fieldToColumn(field)
		})

		return this.database.sequelize.define(entity.name, cols, defOptions)
	}

	/**
	Get the tables structures in database
	@returns {Promise<object>}
	*/
	showTables() {
		return this.dialectTools.showTables()
	}

	/**
	Get an array of indices for a table
	@returns {Promise<object>}
	*/
	getIndices(table) {
		return this.dialectTools.getIndices(table)
	}

	/**
	Add a column in a table
	@param {string} - The table's name
	@param {string} - The column's name
	@param {object} - The entity's field
	@returns {Promise}
	*/
	addColumn(table, column_name, field) {
		const dbfield = this.fieldToColumn(field)
		return this.dialectTools.addColumn(table, column_name, dbfield)
	}

	/**
	Change a column structure in a table
	@param {string} - The table's name
	@param {string} - The column's name
	@param {object} - The entity's field
	@returns {Promise}
	*/
	changeColumn(table, column_name, field) {
		const dbfield = this.fieldToColumn(field)
		return this.dialectTools.changeColumn(table, column_name, dbfield)
	}

	/**
	Remove a column in a table
	@param {string} - The table's name
	@param {string} - The column's name
	@returns {Promise}
	*/
	removeColumn(table, column_name) {
		return this.dialectTools.removeColumn(table, column_name)
	}

	/**
	Rename a column in a table
	@param {string} - The table's name
	@param {string} - The column's name
	@param {string} - The column's new name
	@returns {Promise}
	*/
	renameColumn(table, column_name, column_new_name) {
		return this.dialectTools.renameColumn(table, column_name, column_new_name)
	}

	/**
	Adds a constraint
	@param {string} - The table's name
	@param {string} - The constraint's object: `name` for named constraint, `fields` are the fields' name to add in the constraint, `type` can be "primary" or "unique"
	@returns {Promise}
	*/
	addConstraint(table, constraint) {
		return this.dialectTools.addConstraint(table, constraint)
	}

	/**
	Drops a constraint
	@param {string} - The table's name
	@param {string} - The constraint's object: `name` to drop a named constraint, `field` to drop a field from its constraints, `type` can be "primary" "unique" or "references"
	@returns {Promise}
	*/
	dropConstraint(table, constraint) {
		return this.dialectTools.dropConstraint(table, constraint)
	}

	/**
	Change a column's type when it needs a cast.
	@param {string} - The table's name
	@param {string} - The column's name
	@param {string} - The current field type
	@param {string} - The new field type
	@returns {Promise<boolean>} - `true` if it has changed the column type, `false` otherwise.
	*/
	castColumnType(table, column_name, old_type, type) {
		return this.dialectTools.castColumnType(table, column_name, old_type, type)
	}

	authenticate() {
		return this.dialectTools.authenticate()
	}

	quoteIdentifier(identifier) {
		return this.database.sequelize.getQueryInterface().QueryGenerator.quoteIdentifier(identifier)
	}

	escape(val) {
		return this.database.sequelize.getQueryInterface().QueryGenerator.escape(val)
	}


	columnToField(field) {
		let types = []
		for (let type of (Array.isArray(field.type) ? field.type : [field.type])) {
			let formattedType = type.toLowerCase().replace(/\(.*\)/g,'').trim()
			if ( ! typemap[formattedType])
				throw new Error('Unknown type : "' + formattedType + '"')
			types.push(typemap[formattedType])
		}

		let res: any = {
			name: field.name,
			type: types.length == 1 ? types[0] : types,
			primary: !! field.primaryKey,
			unique: field.unique || false,
			required: ! field.allowNull,
			default: false,
			read: true,
			autoIncrement: false
		}

		if (field.autoIncrement) {
			res.autoIncrement = true
		}

		if (field.defaultValue != undefined) {
			let defaultValues = []
			for (let def of (Array.isArray(field.defaultValue) ? field.defaultValue : [field.defaultValue])) {
				if (/nextval\(.+::regclass\)/.exec(def)) {
					res.autoIncrement = true
				} else  {
					res.default = true
					let textValue = /['"](.*?)['"]?::text/.exec(def)
					defaultValues.push(textValue ? textValue[1] : def)
				}
			}

			if (res.default) {
				res.defaultValue = defaultValues.length == 1 ? defaultValues[0] : defaultValues
			}
		}

		res.write = ! res.autoIncrement

		if (field.fk) {
			if (field.onUpdate != "CASCADE") {
				res.onUpdate = field.onUpdate || "NO ACTION"
			}

			if ( ! field.allowNull && field.onDelete != "CASCADE" || field.allowNull && field.onDelete != "SET NULL") {
				res.onDelete = field.onDelete || "NO ACTION"
			}
		}


		return res
	}

	flattenField(field) {
		let res = {}
		for (let k in field) {
			res[k] = (Array.isArray(field[k])) ? field[k][0] : field[k]
		}
		return res
	}

	fieldToColumn(field) {
		let type = (field.type && field.type.toLowerCase()) || 'text'
		let res:any = {}
		if (field.type != undefined) {
			if (this.database.type == 'mysql' && ( ! type || type == 'text')) {
				res.type = Sequelize.STRING
			} else {
				res.type = (type && sequelize_typemap[type]) || Sequelize.TEXT
			}
		}
		if (field.primary != undefined) {
			res.primaryKey = field.primary
		}
		if (field.unique != undefined) {
			res.unique = field.unique
		}
		if (field.autoIncrement != undefined) {
			res.autoIncrement = field.autoIncrement
		}
		if (field.default == '$now' && type.toLowerCase() == 'date') {
			res.default = Sequelize.NOW
		}
		if (field.required != undefined) {
			res.allowNull = ! field.required
		}
		if (field.default != undefined) {
			res.default = field.default
		}

		if (field.defaultValue != undefined && field.default !== false) {
			if ( ! isNaN(field.defaultValue) || type.toLowerCase() != 'number') {
				res.defaultValue = field.defaultValue
			}
		}

		if (field.isRelation) {
			if (field.isRelation.type == 'belongsTo') {
				res.references = {
					model: field.isRelation.reference.entity,
					key: field.isRelation.reference.field
				}
				res.onUpdate = field.onUpdate || 'cascade'
				res.onDelete = field.onDelete || (res.allowNull ? 'set null' : 'cascade')
			}
		}

		return res
	}
}