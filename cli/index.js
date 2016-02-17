'use strict'
var process = require('process')
var argv = require('minimist')(process.argv.slice(2))

var pckg_info = require('../package.json')
var colors = require('colors')
//var addons = require('./addons')
var args = argv._
var options = argv

var fs = require('fs')
var path = require('path')

options.help = options.help || options.h

var help = require('./help')
var App = require('../lib/app')

//Command line parse
if (options.help && args.length == 0) {
	help.index()
}
else if (argv.version || argv.v) {
	console.log(pckg_info.name + ' ' + pckg_info.version.yellow)
}
else {
	if (args[0] == 'init') {
		console.log('Initialize ' + 'materia'.yellow + ' in the current directory')
	}
	/*else if (args[0] == 'addons') {
		if (args[1] == 'install') {
			addons.install(args[2])
		}
		else if (args[1] == 'update') {
			addons.update(args[2])
		}
		else if (args[1] == 'remove') {
			addons.remove(args[2])
		}
		else if (args[1] == 'list') {
			addons.list()
		}
		else if (args[1] == 'search') {
			addons.search(args[2])
		}
	}*/
	else if (args[0] == 'components') {
		console.log('components')
	}
	else if (args[0] == 'layouts') {
		console.log('layouts')
	}
	else if (args[0] == 'models') {
		console.log('models')
	}
	else if (args[0] == 'start') {
		//console.log argv
		let cwd = process.cwd();
		if (args.length >= 2 && args[1]) {
			cwd = args[1]
		}
		options['database-host'] = options['database-host'] || process.env.MATERIA_DATABASE_HOST
		options['database-port'] = options['database-port'] || process.env.MATERIA_DATABASE_PORT
		options['mode'] = options['mode'] || process.env.MATERIA_MODE
		console.log('Starting ' + 'materia'.yellow + ' in ' + cwd.green)
		let app = new App('', cwd, options)
		app.load().then(() => {
			app.start()
		}, (err) => {
			console.error(err)
		})
	}
}
