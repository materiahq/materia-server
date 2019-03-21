import * as events from 'events';
import chalk from 'chalk';
import { join, sep, dirname, relative, normalize, extname, basename } from 'path';
import * as fse from 'fs-extra';
import {
	IAppConfig,
	IDatabaseConfig,
	IServerConfig,
	IAppOptions,
	ITreeFile
} from '@materia/interfaces';

import { Logger } from './logger';
import { Config, ConfigType } from './config';
import { Server } from './server';
import { Entities } from './entities';
import { Database } from './database';
import { Synchronizer } from './synchronizer';
import { SelfMigration } from './self-migration';
import { History } from './history';
import { Client } from './client';

import { Addons } from './addons';
import { Api } from './api';

import { MateriaError } from './error';
import { MateriaApi } from '../api';
import { Watcher } from './watcher';
import { Actions } from './actions';

export * from './addons/helpers';

export enum AppMode {
	DEVELOPMENT = <any>'dev',
	PRODUCTION = <any>'prod'
}
/**
 * @class App
 * @classdesc
 * The main objects are available from this class.
 * @property {Server} server - Access to the server's options
 * @property {Api} api - Access to the server's endpoints
 * @property {History} history - Access to the history and past actions
 * @property {Database} database - Access to the database methods
 * @property {Addons} addons - Access to the addons methods
 * @property {Entities} entities - Access to the app's entities
 */
export class App extends events.EventEmitter {
	id: string;
	name: string;
	package: string;
	version?: string;
	icon?: string;
	zoom?: number;
	// private packageJsonCache?: string

	materia_path: string = __dirname;

	mode = AppMode.DEVELOPMENT;
	loaded = false;

	// infos: IMateriaConfig

	history: History;
	entities: Entities;
	addons: Addons;
	database: Database;
	api: Api;
	server: Server;
	// websocket: Websocket
	client: Client;
	logger: Logger;
	config: Config;
	selfMigration: SelfMigration;
	materiaApi: MateriaApi;
	watcher: Watcher;

	// git: any

	status: boolean;
	live = false;


	synchronizer: Synchronizer;

	invalid: boolean;
	error: string;

	rootPassword: string;
	actions: Actions;

	constructor(public path: string, public options?: IAppOptions) {
		super();
		process.env.TZ = 'UTC';

		if ( ! this.options ) {
			this.options = {};
		}

		if ( this.options.prod ) {
			this.options.mode = 'prod';
		}

		if ( ! this.options.mode ) {
			this.mode = AppMode.DEVELOPMENT;
		} else if (['development', 'dev', 'debug'].indexOf(this.options.mode) != -1) {
			this.mode = AppMode.DEVELOPMENT;
		} else if (this.options.mode == 'production' || this.options.mode == 'prod') {
			this.mode = AppMode.PRODUCTION;
			if ( ! this.options.runtimes) {
				this.options.runtimes = 'core';
			}
		} else {
			throw new MateriaError('Unknown mode', {
				// tslint:disable-next-line:max-line-length
				debug: 'Option --mode can be development (development/dev/debug) or production (production/prod). e.g. materia start --mode=prod or materia start --mode=dev'
			});
		}

		this.logger = new Logger(this);

		this.history = new History(this);
		this.addons = new Addons(this);
		this.entities = new Entities(this);
		this.database = new Database(this);
		this.api = new Api(this);
		this.server = new Server(this);
		this.client = new Client(this);
		this.synchronizer = new Synchronizer(this);
		this.config = new Config(this);
		this.materiaApi = new MateriaApi(this);
		this.watcher = new Watcher(this);

		this.actions = new Actions(this);

		this.status = false;

		this.selfMigration = new SelfMigration(this);
	}


	loadMateria(): Promise<void> {
		return this.doSelfMigrations()
			.then(() => {
				this.config.reloadConfig();
				const appConfig = this.config.get<IAppConfig>(this.mode, ConfigType.APP);
				if (appConfig) {
					this.package = appConfig.package;
					this.name = appConfig.name;
					this.version = appConfig.version;
					this.icon = appConfig.icon;
					this.rootPassword = appConfig.rootPassword;
				}
			});
	}

	startFallback(): Promise<any> {
		this.server.load();

		this.materiaApi.initialize();

		return this.server.start({
			fallback: true
		}).then(port => port);
	}


	load(): Promise<any> {
		let elapsedTimeQueries, elapsedTimeEntities, elapsedTimeAPI;
		const elapsedTimeGlobal = new Date().getTime();

		this.api.removeAll({save: false});

		return this.loadMateria()
		.then(() => {
			this.logger.log(`${chalk.bold('(Load)')} Application: ${chalk.yellow.bold(this.name || this.package)}`);
			this.logger.log(` └── Path: ${chalk.bold(this.path)}`);
			this.logger.log(` └── Mode: ${chalk.bold(this.mode == AppMode.DEVELOPMENT ? 'Development' : 'Production' )}`);

			this.database.load();
			return this.client.load();
		})
		.then(() => this.server.load())
		.then(() => this.database.start())
		.then(() => this.entities.clear())
		.then(() => this.server.session.initialize())
		.then(() => this.materiaApi.initialize())
		.then(() => this.logger.log(` └── Sessions: ${chalk.green.bold('OK')}`))
		.then(() => this.addons.loadAddons())
		.then(() => this.addons.loadFiles())
		.then(() => this.entities.loadFiles())
		.then(() => this.logger.log(' └─┬ Entities'))
		.then(() => elapsedTimeEntities = new Date().getTime())
		.then(() => this.addons.loadEntities())
		.then(() => this.entities.loadEntities())
		.then(() => this.entities.loadRelations())
		.then(() =>
			// tslint:disable-next-line:max-line-length
			this.logger.log(` │ └── ${chalk.green.bold('OK') + ' - Completed in ' + chalk.bold(((new Date().getTime()) - elapsedTimeEntities).toString() + 'ms')}`)
		)
		.then(() => this.entities.resetModels())
		.then(() => this.logger.log(' └─┬ Queries'))
		.then(() => elapsedTimeQueries = new Date().getTime())
		.then(() => this.addons.loadQueries())
		.then(() => this.entities.loadQueries())
		.then(() => this.logger.log(' └─┬ Actions'))
		.then(() => elapsedTimeQueries = new Date().getTime())
		.then(() => this.addons.loadActions())
		.then(() => this.actions.load())
		.then(() =>
			// tslint:disable-next-line:max-line-length
			this.logger.log(` │ └── ${chalk.green.bold('OK') + ' - Completed in ' + chalk.bold(((new Date().getTime()) - elapsedTimeQueries).toString() + 'ms')}`)
		)
		.then(() => this.api.resetControllers())
		.then(() => this.logger.log(` └─┬ API`))
		.then(() => elapsedTimeAPI = new Date().getTime())
		.then(() => this.addons.loadAPI())
		.then(() => this.api.load())
		.then(() =>
			// tslint:disable-next-line:max-line-length
			this.logger.log(` │ └── ${chalk.green.bold('OK') + ' - Completed in ' + chalk.bold(((new Date().getTime()) - elapsedTimeAPI).toString() + 'ms')}`)
		)
		.then(() => this.watcher.load())
		.then(() => this.history.load())
		.then(() =>
			this.logger.log(` └── ${chalk.green.bold('Successfully loaded in ' + ((new Date().getTime()) - elapsedTimeGlobal).toString() + 'ms')}\n`)
		)
		.then(() => null);
	}

	createDockerfile(options?) {
		const dockerfile = join(this.path, 'Dockerfile');
		const dbProd = this.config.get<IDatabaseConfig>(AppMode.PRODUCTION, ConfigType.DATABASE);
		const webProd = this.config.get<IServerConfig>(AppMode.PRODUCTION, ConfigType.SERVER);
		fse.writeFileSync(dockerfile, `FROM node:7.10-alpine
MAINTAINER ${options && options.author ? options.author : 'me@company.com'}

RUN mkdir -p /app

# invalidate cache
RUN uptime

COPY . /app

WORKDIR /app

RUN npm install

ENV MATERIA_MODE production

EXPOSE ${webProd.port}
CMD ["npm", "start"]`);

		let dbstr = '';
		if (Database.isSQL(dbProd) && dbProd.type == 'postgres') {
			// dbport = 5432
			dbstr = `
    image: postgres:9.6.3-alpine
    environment:
      POSTGRES_USER: "${dbProd.username}"
      POSTGRES_PASSWORD: "${dbProd.password}"
      POSTGRES_DB: "${dbProd.database}"`;
		} else if (Database.isSQL(dbProd) && dbProd.type == 'mysql') {
			// dbport = 3306
			dbstr = `
    image: mysql
    environment:
      MYSQL_ROOT_PASSWORD: "${dbProd.password}"
      MYSQL_DATABASE: "${dbProd.database}"`;
			if (dbProd.username != 'root') {
				dbstr += `
      MYSQL_USER: "${dbProd.username}"
      MYSQL_PASSWORD: "${dbProd.password}"`;
			}
		}

		fse.writeFileSync(join(this.path, 'docker-compose.yaml'), `version: "3"
services:
  db: ${dbstr}
  web:
    build: .
    ports:
      - "${webProd.port}:${webProd.port}"
    links:
      - db
    depends_on:
      - db
    environment:
      MATERIA_MODE: "production"
      NO_HOST: "true"`);
	}

	createAppYaml(options) {
		const appyaml = join(this.path, 'app.yaml');
		fse.writeFileSync(appyaml, `runtime: nodejs
env: flex

skip_files:
 - ^node_modules$
 - ^.materia/live$
 - ^.git$

env_variables:
  MATERIA_MODE: 'production'
  NO_HOST: true

beta_settings:
 cloud_sql_instances: ${options.project}:${options.region}:${options.instance}

manual_scaling:
  instances: ${options.scale}`);
	}

	saveGCloudSettings(settings) {
		fse.writeFileSync(join(this.path, '.materia', 'gcloud.json'), JSON.stringify(settings, null, 2));
	}

	setPackageScript(name, script) {
		let pkg;
		try {
			const content = fse.readFileSync(join(this.path, 'package.json')).toString();
			pkg = JSON.parse(content);
			pkg.scripts[name] = script;
			fse.writeFileSync(join(this.path, 'package.json'), JSON.stringify(pkg, null, 2));
		} catch (e) {
			if (e.code != 'ENOENT') {
				throw e;
			}
		}
	}

	saveMateria() {
		let pkg;
		try {
			const content = fse.readFileSync(join(this.path, 'package.json')).toString();
			pkg = JSON.parse(content);
		} catch (e) {
			if (e.code != 'ENOENT') {
				throw e;
			}
		}
		pkg.name = this.package;

		fse.writeFileSync(join(this.path, 'package.json'), JSON.stringify(pkg, null, 2));
	}

	/**
	Starts the materia app
	@returns {Promise<number>}
	*/
	start(): Promise<number> {
		const errors = {} as any;
		this.logger.log(`${chalk.bold('(Start)')} Application ${chalk.yellow.bold(this.name)}`);
		const p = this.database.started ? Promise.resolve() : this.database.start();
		return p.catch((e) => {
			errors.db = e;
		}).then((e) => {
			if (this.database.disabled) {
				this.logger.log(` └── Database: ${chalk.red.bold('Disabled')}`);
			} else {
				this.logger.log(` └── Database: ${chalk.green.bold('OK')}`);
			}
			if (Object.keys(errors).length == 0) {
				return this.entities.start().catch((err) => {
					errors.entities = err;
				});
			} else {
				return Promise.resolve();
			}
		}).then(() => {
			if ( ! this.database.disabled ) {
				this.logger.log(` └── Entities: ${chalk.green.bold('OK')}`);
			}
			if (Object.keys(errors).length == 0) {
				return this.addons.start().catch((e) => {
					errors.addons = e;
				});
			} else {
				return Promise.resolve();
			}
		}).then(() => {
			this.logger.log(` └── Addons: ${chalk.bold.green('OK')}`);
			if (Object.keys(errors).length == 0 && this.mode == AppMode.PRODUCTION && ! this.live && ! this.database.disabled) {
				return this.synchronizer.diff().then((diffs) => {
					if (diffs && diffs.length == 0) {
						this.logger.log(` └── Synchronize: ${chalk.bold('DB already up to date')}`);
						return;
					}
					this.logger.log(` └─┬ Synchronize: ${chalk.yellow.bold('The database structure differs from entities.')}`);
					return this.synchronizer.entitiesToDatabase(diffs, {}).then((actions) => {
						// tslint:disable-next-line:max-line-length
						this.logger.log(` │ └── Database: ${chalk.green.bold('Updated successfully')}. (Applied ${chalk.bold(actions.length.toString())} actions)`);
					});
				}).catch((e) => {
					this.logger.log(` │ └── Database: ${chalk.red.bold('Fail - An action could not be applied: ' + e)}`);
					e.errorType = 'sync';
					throw e;
				});
			}
		}).then(() =>
			this.server.start({
				fallback: Object.keys(errors).length > 0
			})
		);
	}

	startWithoutFailure() {
		return this.server.start();
	}

	/**
	Stops the materia app
	@returns {Promise}
	*/
	stop(): Promise<void> {
		return this.server.stop()
			.then(() => this.database.stop())
			.then(() => this.watcher.dispose())
			.then(() => { this.status = false; });
	}

	getAllFiles(name, p) {
		name = name || this.name;
		p = p || this.path;
		// let results = []

		return new Promise((accept, reject) => {
			fse.readdir(p, (err, files) => {
				const promises = [];
				if ( err ) {
					return reject( err );
				}
				files.forEach((file) => {
					if (file != '.DS_Store' &&
					file != '.git' &&
					file != 'history.json' &&
					file != 'history' &&
					file != 'node_modules' &&
					file != 'bower_components' &&
					file != '_site') {
						promises.push(this._getFile(file, p));
					}
				});
				Promise.all(promises).then((results) => {
					accept({
						filename: name,
						path: p,
						fullpath: p,
						children: results
					});
				}, (reason) => {
					reject(reason);
				});
			});
		});
	}

	getFile(filepath: string): ITreeFile {
		if ( ! filepath) {
			throw new Error('You must provide a file path to retieve');
		}
		if ( ! fse.existsSync(filepath)) {
			throw new Error('File with provided path not found');
		}
		const filename = basename(filepath);
		const basePath = dirname(filepath);
		const relativePath = normalize(relative(this.path, filepath));
		return {
			filename: filename,
			fullpath: filepath,
			path: basePath,
			relativepath: relativePath,
			isDir: false,
			extension: extname(filepath).replace('.', '')
		};
	}

	getFiles(depth: number, name?: string, p?: string): ITreeFile {
		const splittedName = this.path.split(sep);
		const length = splittedName.length;
		const appFolder = splittedName[length - 1];
		name = name || appFolder;
		p = p || this.path;

		const files = [];
		const folders = [];

		if (depth) {
			const children = fse.readdirSync(p);
			children.forEach((file) => {
				if (file != '.DS_Store' && file != '.git') {
					const stats = fse.lstatSync(join(p, file));
					if (stats.isDirectory()) {
						folders.push(this.getFiles(depth - 1, file, join(p, file)));
					} else {
						const fullpath = join(p, file);
						const fileRelativepath = normalize(relative(this.path, fullpath));
						files.push({
							filename: file,
							path: p,
							isDir: false,
							fullpath: fullpath,
							relativepath: fileRelativepath,
							extension: extname(file).replace('.', '')
						});
					}
				}
			});
		}
		const folderRelativepath = normalize(relative(this.path, p));
		return {
			filename: name,
			path: dirname(p),
			isDir: true,
			fullpath: p,
			relativepath: folderRelativepath,
			incomplete: ! depth,
			children: [...folders, ...files]
		};
	}

	initializeStaticDirectory() {
		let p = Promise.resolve();
		if ( ! fse.existsSync(join(this.path, 'client'))) {
			fse.mkdirSync(join(this.path, 'client'));
			if ( ! fse.existsSync(join(this.path, 'client', 'index.html'))) {
				fse.writeFileSync(join(this.path, 'client', 'index.html'), `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Document</title>
	</head>
	<body>
		<h1>Hello world!</h1>
	</body>
	</html>`);
			}
			this.server.dynamicStatic.setPath(join(this.path , 'client'));
		} else {
			p = Promise.reject(new Error('Client folder already exists'));
		}
		return p;
	}

	getWatchableFiles() {
		const files = this.getFiles(5);
		return this._getWatchableFiles(files.children);
	}

	readFile(fullpath): string {
		return fse.readFileSync(fullpath, 'utf-8');
	}

	saveFile(fullpath: string, content: string, opts?): Promise<any> {
		let p = Promise.resolve();
		if (opts && opts.mkdir) {
			try {
				fse.mkdirpSync(dirname(fullpath));
			} catch (e) {
				p = Promise.reject(e);
			}
		}

		return p.then(() => {
			fse.writeFileSync(fullpath, content);
		}).catch((e) => {
			throw e;
		});
	}

	getMateriaVersion(): string {
		const pkg = require('../package.json');
		return pkg.version;
	}

	private doSelfMigrations() {
		if ( this.selfMigration ) {
			return this.selfMigration.check().then(() => {
				delete this.selfMigration;
			});
		}
		return Promise.resolve();
	}

	private _getFile(file, p) {
		return new Promise((accept, reject) => {
			fse.lstat(join(p, file), (err, stats) => {
				if ( err ) {
					return reject( err );
				}
				if (stats.isDirectory()) {
					this.getAllFiles(file, join(p, file)).then((res) => {
						accept(res);
					}).catch((e) => {
						reject(e);
					});
				} else {
					accept({
						filename: file,
						path: p,
						fullpath: join(p, file)
					});
				}
			});
		});
	}

	private _getWatchableFiles(files) {
		const res = [];
		for (const file of files) {
			if ( ! Array.isArray(file.children)) {
				const filenameSplit = file.filename.split('.');
				if (['json', 'js', 'coffee', 'sql'].indexOf(filenameSplit[filenameSplit.length - 1]) != -1) {
					res.push(file);
				}
			} else {
				const t = this._getWatchableFiles(file.children);
				t.forEach((a) => { res.push(a); });
			}
		}
		return res;
	}
}