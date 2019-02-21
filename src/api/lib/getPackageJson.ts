import * as fs from 'fs';
import * as path from 'path';

import { App } from '../../lib';

export function getPackageJson(app: App, mod: string) {
	const cwd = app.path;
	return new Promise((resolve, reject) => {
		const p = path.join(cwd, 'node_modules', mod, 'package.json');
		fs.readFile(p, 'utf-8', (e, data) => {
			if (e) {
				reject(e);
			} else {
				resolve(JSON.parse(data));
			}
		});
	});
}