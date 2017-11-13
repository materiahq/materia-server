import { App, AppMode } from './app'

var prettyError:any = require('pretty-error');

export class Logger {
	console: any
	pe: any

	constructor(private app: App) {
		this.pe = prettyError.start();

		this.pe.skipNodeFiles();
		this.pe.skipPackage('express');
		this.pe.skipPackage('mocha');
		this.pe.alias(app.path, '');
		this.pe.alias(app.materia_path, '[materia]');

		this.console = console

		if (app.options.nocolors) {
			this.pe.withoutColors();
			this.pe.appendStyle({
				'pretty-error': {
					marginLeft: 0
				},
				'pretty-error > trace > item': {
					marginLeft: 0,
					bullet: '"<grey> - </grey>"'
				}
			})
		}

	}

	setConsole(cons) {
		this.console = cons || console
	}

	warn(...params) {
		var args = [];
		params.forEach(val => {
			if (val && val instanceof Error)
				args.push(this.pe.render(val));
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
				args.push(this.pe.render(val));
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
				args.push(this.pe.render(val));
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
}