import { existsSync, readFileSync } from 'fs-extra';
import { join, resolve } from 'path';
import chalk from 'chalk';
import { Sequelize, Options, Dialect, QueryTypes } from 'sequelize';
import { IDatabaseConfig, ISQLDatabase, ISQLiteDatabase } from '@materia/interfaces';

import { App, AppMode } from './app';
import { ConfigType } from './config';
import { DatabaseInterface } from './database/interface';
import { MateriaError } from './error';

const dialect = {
	postgres: 'PostgreSQL',
	mysql: 'MySQL',
	sqlite: 'SQLite'
};

const DEFAULT_DATABASE_MYSQL = 'mysql';
const DEFAULT_DATABASE_POSTGRES = 'postgres';

const defaultDatabase = {
	mysql: DEFAULT_DATABASE_MYSQL,
	postgres: DEFAULT_DATABASE_POSTGRES
};

/**
 * @class Database
 * @classdesc
 * Represent the connection to database
 */
export class Database {
	interface: DatabaseInterface;

	disabled: boolean;
	locked = false;

	host: string;
	port: number;
	username: string;
	password: string;
	database: string;
	storage: string;
	type: Dialect;
	started: boolean;

	opts: Options;
	sequelize: Sequelize;

	constructor(private app: App) {
		this.interface = new DatabaseInterface(this);
	}

	static isSQL(settings: IDatabaseConfig): settings is ISQLDatabase {
		return settings.type !== 'sqlite';
	}
	static isSQLite(settings: IDatabaseConfig): settings is ISQLiteDatabase {
		return settings.type === 'sqlite';
	}

	/**
	Load the database configuration
	@param {object} - *optional* The settings of the database
	@returns {object}
	*/
	load(settings?: IDatabaseConfig): boolean {
		this.disabled = false;
		if ( ! settings && this.app.path) {
			this.app.config.reloadConfig();
			if (this.app.live) {
				settings = this.app.config.get<IDatabaseConfig>(this.app.mode, ConfigType.DATABASE, {live: true});
			}
			settings = settings || this.app.config.get<IDatabaseConfig>(this.app.mode, ConfigType.DATABASE);
		}

		if ( ! settings || ! settings.type ) {
			this.disabled = true;
			this.app.logger.log(` └── Database: ${chalk.yellow.bold('No database configured!')}`);
			return false;
		}
		if (Database.isSQL(settings)) {
			this.host = this.app.options['database-host'] || settings.host || 'localhost';
			this.port = Number(this.app.options['database-port'] || settings.port);
			this.username = this.app.options['database-username'] || settings.username;
			this.password = this.app.options['database-password'] || settings.password;
			this.database = this.app.options['database-db'] || settings.database;
		} else if (Database.isSQLite(settings)) {
			this.storage = this.app.options['storage'] || settings.storage;
		}

		this.type = (settings.type as Dialect);
		this.started = false;

		let logging: any;
		if (this.app.options.logSql == true) {
			logging = (...args) => { this.app.logger.log.apply(this.app.logger, args); };
		} else if (this.app.options.logSql !== undefined) {
			logging = this.app.options.logSql;
		} else {
			logging = false;
		}

		this.opts = {
 			dialect: this.type,
			host: this.host,
			port: this.port,
			logging: logging,
			dialectOptions: {}
		};
		if (this.type !== 'sqlite') {
			if ((settings as ISQLDatabase).ssl) {
				this.opts.dialectOptions['ssl'] = true;
			}
		}

		if (Database.isSQLite(settings)) {
			this.opts.storage = resolve(this.app.path, this.storage || 'database.sqlite');
		}

		if (this.app.mode == AppMode.PRODUCTION && process.env.GCLOUD_PROJECT && this.type == 'mysql') {
			try {
				const gcloudJsonPath = join(this.app.path, '.materia', 'gcloud.json');
				if (existsSync(gcloudJsonPath)) {
					const gcloudSettings = JSON.parse(readFileSync(gcloudJsonPath, 'utf-8'));
					this.opts.dialectOptions = { socketPath: `/cloudsql/${gcloudSettings.project}:${gcloudSettings.region}:${gcloudSettings.instance}` };
					delete this.opts.host;
					delete this.opts.port;
				} else {
					throw new MateriaError('gcloud.json not found');
				}
			} catch (e) {
				this.app.logger.log(chalk.yellow(` └── Warning: Impossible to load GCloud database settings - ${chalk.bold(e)}`));
			}
		}

		this.app.logger.log(` └─┬ Database: ${chalk.green.bold('OK')}`);
		this.app.logger.log(` │ └── Dialect: ${chalk.bold(dialect[this.type])}`);
		if (this.type == 'sqlite') {
			this.app.logger.log(` │ └── File: ${chalk.bold(this.storage || 'database.sqlite')}`);
		} else {
			this.app.logger.log(` │ └── Host: ${chalk.bold(this.host)}`);
			this.app.logger.log(` │ └── Port: ${chalk.bold(this.port.toString())}`);
		}

		return true;
	}

	/**
	Try to connect with a custom configuration
	@param {object} - The configuration object
	@returns {Promise}
	*/
	static tryDatabase(settings: IDatabaseConfig, app?: App): Promise<void> {
		// TODO: check settings.storage to be a real path
		if (this.isSQLite(settings) && settings.storage) {
			return Promise.resolve();
		}

		const optsDialect = {
			dialect: settings.type,
			logging: false
		};
		let opts: Options;
		if (Database.isSQL(settings)) {
			opts = Object.assign({}, optsDialect, {
				host: settings.host,
				port: settings.port
			});
		} else if (Database.isSQLite(settings) && app) {
			opts.storage = resolve(app.path, settings.storage || 'database.sqlite');
		}
		let tmp;
		return new Promise((accept, reject) => {
			try {
				if (Database.isSQL(settings)) {
					tmp = new Sequelize(settings.database, settings.username, settings.password, opts);
				} else if (Database.isSQLite(settings)) {
					tmp = new Sequelize(null, null, null, opts);
				}
				tmp.authenticate().then(() => {
					tmp.close();
					accept();
				}).catch((e) => { reject(e); });
			} catch (e) {
				return reject(e);
			}
		});
	}

	/**
	Try to connect database server default database with username password
	MySQL or PostgreSQL only
	@param {object} - The configuration object
	@returns {Promise}
	 */

	static tryServer(settings: IDatabaseConfig, app?: App) {
		if (!Database.isSQL(settings)) {
			return Promise.reject(new Error("You can't try to connect to SQLite with username/password"));
		}
		const opts: Options = {
			dialect: (settings.type as Dialect),
			host: settings.host,
			port: settings.port,
			logging: false
		};
		return new Promise((accept, reject) => {
			try {
				const tmpConnect = new Sequelize(defaultDatabase[settings.type], settings.username, settings.password, opts);
				tmpConnect.authenticate().then(() =>
					tmpConnect.close()
				).then(accept).catch(reject);
			} catch (e) {
				reject(e);
			}
		});
	}


	/**
	List databases in mysql or postgres instances
	MySQL and PostgreSQL only
	@param settings - The configuration object
	@returns {Promise}
	 */
	static listDatabases(settings: IDatabaseConfig): Promise<any> {
		if (!Database.isSQL(settings)) {
			return Promise.reject(new Error(`You can't list database on a SQLite database`));
		}
		const opts: Options = {
			dialect: (settings.type as Dialect),
			host: settings.host,
			port: settings.port,
			logging: false
		};
		return new Promise((accept, reject) => {
			try {
				const tmp = new Sequelize(defaultDatabase[settings.type], settings.username, settings.password, opts);
				let query: string;
				let field: string;
				if (settings.type == 'mysql') {
					query = `SHOW DATABASES`;
					field = 'Database';
				} else if (settings.type == 'postgres') {
					query = `SELECT datname FROM pg_database`;
					field = 'datname';
				}
				tmp.query(query).spread((results: any, metadata) => {
					const formatedResult = [];
					for (const i in results) {
						if (results[i]) {
							const result = results[i];
							formatedResult.push(result[field]);
						}
					}
					return accept(formatedResult);
				});
			} catch (e) {
				return reject(e);
			}
		});
	}

	/**
	 Create new database in mysql or postgresql instances
	 @param settings - The configuration object
	 @param name - Name for the new database
	 */
	static createDatabase(settings, name) {
		const opts: Options = {
			dialect: settings.type,
			host: settings.host,
			port: settings.port,
			logging: false
		};
		let tmp;
		return new Promise((accept, reject) => {
			const dbName = defaultDatabase[settings.type] === DEFAULT_DATABASE_MYSQL ? '`' + name + '`' : `"${name}"`;
			try {
				tmp = new Sequelize(defaultDatabase[settings.type], settings.username, settings.password, opts);
			} catch (e) {
				return reject(e);
			}
			return tmp.query(`CREATE DATABASE ${dbName}`).spread((results, metadata) => {
				return accept();
			}).catch(err => reject(err.message));
		});
	}

	tryDatabase(settings) {
		return Database.tryDatabase(settings, this.app);
	}

	tryServer(settings) {
		return Database.tryServer(settings, this.app);
	}

	listDatabases(settings) {
		return Database.listDatabases(settings);
	}

	createDatabase(settings, name) {
		return Database.createDatabase(settings, name);
	}

	runSql(query: string): Promise<any> {
		return this.sequelize.query(
			query,
			{
				type: QueryTypes[query.split(' ')[0]] ?? 'sql'
			}
		);
	}

	/**
	Connect to the database
	@returns {Promise}
	*/
	start(): Promise<any> {
		if (this.sequelize) {
			this.stop();
		}

		if ( this.disabled ) {
			return Promise.resolve();
		}
		if ( ! this.interface.hasDialect(this.type)) {
			return Promise.reject(new MateriaError('The database\'s dialect is not supported'));
		}
		this.app.emit('db:start');
		try {
			this.sequelize = new Sequelize(this.database, this.username, this.password, this.opts);
		} catch (e) {
			this.disabled = true;
			return Promise.reject(e);
		}
		this.interface.setDialect(this.type);
		return this.interface.authenticate().then(() => {
			this.app.logger.log(`│ └── Connection: ${chalk.green.bold('Authenticated')}`);

			this.started = true;
		}).catch((e) => {
			this.app.logger.error(`│ └── Connection: ${chalk.red.bold('Failed')}`);
			this.app.logger.error(chalk.red('    (Warning) Impossible to connect the database: ') + chalk.red.bold(e && e.message));
			this.app.logger.error(chalk.red('    The database has been disabled'));
			this.disabled = true;
			return Promise.resolve(e);
		});
	}

	/**
	Stop the database connection
	*/
	stop() {
		this.started = false;
		if (this.sequelize) {
			this.sequelize.close();
			this.sequelize = null;
		}
		return Promise.resolve();
	}


	/**
	Synchronize the database with the state of the application
	@returns {Promise}
	*/
	sync() {
		return this.app.entities.sync().then(() => {
			return this.sequelize.sync();
		});
	}

	// Deprecated: use sync() instead as sequelize({force: true}) will remove all data
	forceSync() {
		return this.app.entities.sync().then(() => {
			return this.sequelize.sync({ force: true });
		});
	}
}
