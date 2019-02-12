import { App } from '../app';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { IPermission } from '@materia/interfaces';

export class Permission {
	app: App;
	name: string;
	description: string;
	readOnly = false;
	middleware: any;
	file: string;
	invalid: boolean;

	constructor(app, data: IPermission) {
		this.app = app;
		this.name = data.name;
		this.description = data.description;
		if (data.readOnly) {
			this.readOnly = data.readOnly;
		}
		if (data.file) {
			this.file = data.file;
		}
		if (data.middleware) {
			this.middleware = data.middleware;
		}
		if (data.invalid) {
			this.invalid = data.invalid;
		}
		this.reload();
	}

	reload(): void {
		if (this.file) {
			let file = this.file;
			if (
				this.file.indexOf(
					join(this.app.path, 'server', 'permissions')
				) === -1
			) {
				file = join(
					this.app.path,
					'server',
					'permissions',
					this.file
				);
			}
			try {
				const rp = require.resolve(file);
				if (require.cache[rp]) {
					delete require.cache[rp];
				}
				this.middleware = require(file);
				if (this.invalid) {
					delete this.invalid;
				}
			} catch (e) {
				if (existsSync(`${file}.js`)) {
					this.middleware = readFileSync(`${file}.js`, 'utf8');
				} else {
					this.middleware = null;
				}
				this.invalid = true;
			}
		}
	}

	toJson(): IPermission {
		let file = this.file;
		if (
			this.file &&
			this.file.indexOf(
				join(this.app.path, 'server', 'permissions')
			) != -1
		) {
			file = this.file.substr(
				join(this.app.path, 'server', 'permissions').length + 1
			);
		}
		return {
			name: this.name,
			description: this.description,
			file: file,
			readOnly: this.readOnly,
			invalid: this.invalid,
			code: this.invalid ? this.middleware : this.middleware ? `module.exports = ${this.middleware.toString()}` : null
		};
	}
}
