import { App, AppMode } from './app'

import chalk from "chalk";

export class Logger {
	console: any
	pe: any

	constructor(private app: App) {
		this.console = console

		if (app.options.nocolors) {
			chalk.enabled = false;
		} else {
			chalk.enabled = true;
			chalk.level = 3;
		}
	}

	setConsole(cons) {
		this.console = cons || console
	}

	warn(...params) {
		var args = [];
		params.forEach(val => {
			if (val && val instanceof Error)
				args.push(this.renderError(val));
			else
				args.push(val);
		})

		this.console.warn.apply(this.console, args)
	}

	log(...params) {
		if (this.app.options.silent)
			return
		var args = [];
		params.forEach(val => {
			if (val && val instanceof Error)
				args.push(this.renderError(val));
			else
				args.push(val);
		})
		this.console.log.apply(this.console, args);
	}

	error(...params) {
		if (this.app.options.silent)
			return
		var args = [];
		params.forEach(val => {
			if (val && val instanceof Error)
				args.push(this.renderError(val));
			else
				args.push(val);
		})
		this.console.error.apply(this.console, args);
	}

	debug() {
		if (this.app.mode != AppMode.DEVELOPMENT)
			return;

		this.log.apply(this, arguments)
	}

	private renderError(error: Error) {
		return chalk.underline.red.bold('\nError: ') + chalk.underline.bold(error.message) + '\n' +
			this.parseStacktrace(error.stack) + '\n'
	}

	private parseStacktrace(stacktrace: string) {
		const lines = stacktrace.split('\n');
		let result;
		lines.some(line => {
			const res = line.match(/   at ([a-zA-Z0-9._]+) \(([^:]+):([0-9]+):([0-9]+)\)/)
			if (res) {
				result = `    - ${chalk.bold(res[1])}: ${this.replacePath(res[2])} - line ${res[3]}`
				return true
			}
			return false;
		})
		return result;
	}

	private replacePath(path: string) {
		return path.replace(this.app.materia_path, '[materia-server]')
			.replace(this.app.path, '');
	}
}