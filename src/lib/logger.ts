import chalk = require('chalk');

import { App, AppMode } from './app';

export class Logger {
	console: any;
	pe: any;

	constructor(private app: App) {
		this.console = console;

		if (app.options.level) {
			chalk.level = app.options.level as chalk.Level;
		}
	}

	setConsole(cons) {
		this.console = cons || console;
	}

	private beautifyParams(params) {
		const result = [];
		params.forEach(val => {
			if (val && val instanceof Error) {
				const errStr = this.renderError(val);
				result.push(`│`);

				errStr.split('\n').forEach(line =>
					result.push(`│ ${line}`)
				);
				result.push(`┴────────`);
			} else if (val && typeof val == 'string') {
				val.split('\n').forEach(line =>
					result.push(line)
				);
			} else if (! val) {
				result.push('\n');
			} else {
				result.push(val);
			}
		});
		return result;
	}

	warn(...params) {
		const lines = this.beautifyParams(params);
		lines.forEach(line => {
			this.console.warn.apply(this.console, [line]);
		});
	}

	log(...params) {
		if (this.app.options.silent) {
			return;
		}
		const lines = this.beautifyParams(params);
		lines.forEach(line => {
			this.console.log.apply(this.console, [line]);
		});
	}

	error(...params) {
		if (this.app.options.silent) {
			return;
		}

		const lines = this.beautifyParams(params);
		lines.forEach(v => {
			this.console.error.apply(this.console, [v]);
		});
	}

	debug() {
		if (this.app.mode != AppMode.DEVELOPMENT) {
			return;
		}

		this.log.apply(this, arguments);
	}

	renderError(error: Error) {
		return chalk.underline.red.bold('Error: ') + chalk.underline.bold(error.message) + '\n' +
			this.parseStacktrace(error.stack);
	}

	private parseStacktrace(stacktrace: string) {
		const lines = stacktrace.split('\n');
		let result;
		lines.some(line => {
			const res = line.match(/   at ([a-zA-Z0-9._]+) \(([^:]+):([0-9]+):([0-9]+)\)/);
			if (res) {
				result = `       - ${chalk.bold(res[1])}: ${this.replacePath(res[2])} - line ${res[3]}`;
				return true;
			}
			return false;
		});
		return result;
	}

	private replacePath(path: string) {
		return path.replace(this.app.materia_path, '[materia-server]')
			.replace(this.app.path, '');
	}
}