import { App } from '../app';
import * as path from 'path';

export interface IPermission {
	name: string;
	description: string;
	readOnly?: boolean;
	middleware: ((req: any, res: any, next: any) => any) | string;
	invalid?: boolean;
	file?: string;
}

export class Permission {
	app: App;
	name: string;
	description: string;
	readOnly: boolean = false;
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
	}

	reload(): Promise<void> {
		if (this.file) {
			let file = this.file;
			if (
				this.file.indexOf(
					path.join(this.app.path, 'server', 'permissions')
				) === -1
			) {
				file = path.join(
					this.app.path,
					'server',
					'permissions',
					this.file
				);
			}
			try {
				let rp = require.resolve(file);
				if (require.cache[rp]) {
					delete require.cache[rp];
				}
				this.middleware = require(file);
				return Promise.resolve();
			} catch (e) {
				return Promise.reject(e);
			}
		} else {
			return Promise.resolve();
		}
	}

	toJson() {
		let file = this.file;
		if (
			this.file &&
			this.file.indexOf(
				path.join(this.app.path, 'server', 'permissions')
			) != -1
		) {
			file = this.file.substr(
				path.join(this.app.path, 'server', 'permissions').length + 1
			);
		}
		return {
			name: this.name,
			description: this.description,
			file: file,
			readOnly: this.readOnly
		};
	}
}
