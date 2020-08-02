import * as path from 'path';
import * as fse from 'fs-extra';
import * as os from 'os';

import { App } from '../../lib/app';
import { ConfigType } from '../../lib/config';
import { IDatabaseConfig } from '@materia/interfaces';

const chai = require('chai');
chai.use(require('chai-http'));
const agent = chai.request.agent('http://localhost:8798');

export class TemplateApp {
	private name: string;
	private before_creation: (new_app: App) => any;

	constructor(name) {
		this.name = name;
		this.before_creation = () => { };
	}

	beforeCreate(before_creation: (new_app: App) => any) {
		this.before_creation = before_creation;
	}

	createInstance(mode?: string): Promise<App> {
		const app_path = fse.mkdtempSync(path.join(os.tmpdir(), 'materia-test-'));
		fse.copySync(path.join(__dirname, '..', '..', '..', 'src', 'test', 'apps', this.name), app_path, { overwrite: true, recursive: true });

		return this.createApp(app_path, mode);
	}

	createApp(app_path: string, mode?: string): Promise<App> {
		const debug_mode = !!process.env.DEBUG;

		mode = mode || 'dev';
		const app = new App(app_path, {
			logRequests: debug_mode,
			logSql: debug_mode,
			mode: mode
		});
		app.config.reloadConfig();
		app.name = this.name;
		app.config.set({
			'host': 'localhost',
			'port': 8798
		}, mode, ConfigType.SERVER);
		// app.config.set({name: this.name}, null, ConfigType.APP)

		if (process.env.DIALECT == 'postgres') {
			const cnf: IDatabaseConfig = {
				type: 'postgres',
				host: process.env.POSTGRES_HOST,
				port: +process.env.POSTGRES_PORT,
				username: process.env.POSTGRES_USERNAME,
				password: process.env.POSTGRES_PASSWORD,
				database: process.env.POSTGRES_DATABASE,
			};
			app.config.set(cnf, mode, ConfigType.DATABASE);
		} else {
			const cnf: IDatabaseConfig = {
				type: 'sqlite',
				storage: 'database.sqlite'
			};
			app.config.set(cnf, mode, ConfigType.DATABASE);
		}

		if (!debug_mode) {
			app.logger.setConsole({
				log: function () { },
				warn: function () { },
				error: function () { }
			});
		}
		return app.config.save().then(() => app);
	}

	async runApp(mode?: string): Promise<App> {
		const app = await this.createInstance(mode || 'dev');
		const off = Promise.resolve(this.before_creation(app));
		return off.then(() => app.load()).then(() => {
			if (process.env.DIALECT == 'postgres') {
				let p: Promise<any> = Promise.resolve();
				[
					'DROP SCHEMA public CASCADE',
					'CREATE SCHEMA public',
					'GRANT ALL ON SCHEMA public TO postgres',
					'GRANT ALL ON SCHEMA public TO public'
				].forEach(q => p = p.then(() => app.database.sequelize.query(q, { raw: true })));
				return p;
			}
		}).then(() => app.start()).then(() => app);
	}

	async resetApp(app: App, while_off?: (new_app: App) => any): Promise<App> {
		let new_app: App;
		await app.stop();
		new_app = await this.createApp(app.path);
		return Promise.resolve(this.before_creation(app))
		.then(() => while_off ? Promise.resolve(while_off(app)) : Promise.resolve())
		.then(() => new_app.load()).then(() => new_app.start())
		.catch(e => {
			return app.start().then(() => {
				throw e;
			});
		})
		.then(() => new_app);
	}

	private promisifyRequest(method: string, url: string, args?: any, type?: string) {
		return new Promise((resolve, reject) => {
			const request = agent[method](url);
			if (type) {
				request.type(type);
			}
			request.send(args).end((err, res) => {
				if (err) {
					return reject(JSON.parse(res.text));
				}
				if (res.body && ((Object.keys(res.body).length > 0 && res.body.constructor === Object) || res.body.constructor != Object)) {
					return resolve(res.body);
				}
				return resolve(res.text);
			});
		});
	}

	get(url: string, args?: any) {
		return this.promisifyRequest('get', url, args);
	}

	post(url: string, args?: any) {
		return this.promisifyRequest('post', url, args);
	}

	put(url, args?) {
		return this.promisifyRequest('put', url, args, 'form');
	}

	del(url, args?) {
		return this.promisifyRequest('del', url, args);
	}

	dbBoolean(val) {
		if (val === undefined || val === null) {
			return val;
		}
		if (!process.env.DIALECT || process.env.DIALECT == 'sqlite') {
			return val ? 1 : 0;
		} else {
			return val;
		}
	}
}