'use strict';

module.exports = (app) => {

	let pe = require('pretty-error').start();

	pe.skipNodeFiles();
	pe.skipPackage('express');
	pe.skipPackage('mocha');
	pe.alias(app.path, '');
	pe.alias(app.materia_path, '[materia]');

	let cons = console

	if (app.options.nocolors) {
		pe.withoutColors();
		pe.appendStyle({
			'pretty-error': {
				marginLeft: 0
			},
			'pretty-error > trace > item': {
				marginLeft: 0,
				bullet: '"<grey> - </grey>"'
			}
		})
	}

	app.setConsole = function(_cons) {
		cons = _cons || console
	}

	app.warning = function() {
		var args = [];
		for (var k in arguments) {
			var arg = arguments[k];
			if (arg && arg instanceof Error)
				args.push(pe.render(arg));
			else
				args.push(arg);
		}

		args.unshift('WARNING:')
		cons.warn.apply(cons, args)
	}

	app.log = function() {
		if (app.options.silent)
			return
		var args = [];
		for (var k in arguments) {
			var arg = arguments[k];
			if (arg && arg instanceof Error)
				args.push(pe.render(arg));
			else
				args.push(arg);
		}
		cons.log.apply(cons, args);
	}

	app.error = function() {
		if (app.options.silent)
			return
		var args = [];
		for (var k in arguments) {
			var arg = arguments[k];
			if (arg && arg instanceof Error)
				args.push(pe.render(arg));
			else
				args.push(arg);
		}
		cons.error.apply(cons, args);
	}

	app.debug = function() {
		if (this.app.mode != 'dev')
			return;

		app.log.apply(app, arguments)
	}
}