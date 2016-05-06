'use strict';

module.exports = (app) => {

	var pe = require('pretty-error').start();

	pe.skipNodeFiles();
	pe.skipPackage('express');
	pe.skipPackage('mocha');
	pe.alias(app.path, '');
	pe.alias(app.materia_path, '[materia]');

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
		console.log.apply(console, args);
	}

	app.debug = function() {
		if (this.app.mode != 'dev')
			return;

		app.log.apply(app, arguments)
	}
}