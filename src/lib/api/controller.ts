import { join } from 'path';
import { readFileSync } from 'fs-extra';
import { MateriaError } from '../error';
import { App } from '../app';

export class Controller {
	private app: App;
	ctrlClass: any;
	ctrlStr: string;
	ctrlInstance: any;

	constructor(app: App) {
		this.app = app;
	}

	load(basePath: string, controller: string): void {
		const ctrlPath = require.resolve(join(basePath, 'server', 'controllers', controller + '.ctrl.js'));
		try {
			if (require.cache[ctrlPath]) {
				delete require.cache[ctrlPath];
			}
			this.ctrlClass = require(ctrlPath);
			this.ctrlStr = readFileSync(ctrlPath, 'utf-8').toString();
			delete this.ctrlInstance;
		} catch (e) {
			const err = new MateriaError(`Could not load controller ${controller}: ${e}`) as any;
			err.originalError = e;
			throw err;
		}
	}

	instance(): any {
		if ( ! this.ctrlInstance) {
			this.ctrlInstance = new this.ctrlClass(this.app);
		}
		return this.ctrlInstance;
	}
}