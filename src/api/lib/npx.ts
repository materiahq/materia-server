import { App } from "../../lib";

import * as path from 'path';
import * as cp from 'child_process';

import { buffer } from './buffer';

export class Npx {
	constructor(private app: App) {}

	call(args, bufferized?: boolean) {
		const cwd = this.app.path;

		const npmPath = path.join(
			__dirname,
			'node_modules',
			'npm',
			'bin',
			`npx-cli.js`
		);
		const proc = cp.fork(npmPath, args, {
			cwd: cwd,
			silent: true
		});
		if (bufferized) {
			return buffer(proc);
		} else {
			return proc;
		}
	}
}