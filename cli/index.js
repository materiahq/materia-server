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
	options['database-host'] = options['database-host'] || process.env.MATERIA_DATABASE_HOST
	options['database-port'] = options['database-port'] || process.env.MATERIA_DATABASE_PORT
	options['database-username'] = options['database-username'] || process.env.MATERIA_DATABASE_USERNAME
	options['database-db'] = options['database-db'] || process.env.MATERIA_DATABASE_DB
	options['mode'] = options['mode'] || process.env.MATERIA_MODE
	options['port'] = options['port'] || process.env.PORT

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
		options['runtimes'] = 'core'
		console.log('Starting ' + 'materia'.yellow + ' in ' + cwd.green)
		let app = new App(cwd, options)
		app.load().then(() => {
			app.start()
		}, (err) => {
			console.error(err)
		})
	}
	else if (args[0] == 'deploy') {
		let cwd = process.cwd();
		let provider = args[1] || 'dockerfile'
		let app = new App(cwd, options)
		app.load().then(() => {
			console.log('Deploying ' + 'materia'.yellow + ' app ' + app.name.green + ' to ' + provider.yellow)
			return app.deploy.generate(provider, options)
		}).then(() => {
			console.log('Deploy files generated')
			console.log('Releasing ' + app.name.green + ' to ' + provider.yellow + '...')
			let proc = app.deploy.spawnRelease(provider, options)
			if (proc === null)
				return Promise.resolve()
			return new Promise((accept, reject) => {
				let gotStderr = false
				proc.on('error', (err) => { reject(err) })
				proc.stdout.on('data', (data) => { process.stdout.write(data) })
				proc.stderr.on('data', (data) => { process.stderr.write(data); gotStderr = true })
				proc.on('close', (code) => {
					// notice that we had some error text with gotStderr ?
					accept(code)
				})
			})
		}).then((code) => {
			if (code == 0)
				console.log('Deployed to ' + provider.yellow + ' !')
			else {
				console.error('Release finished with return code: ' + code.toString().yellow)
				console.error('This release might contain some errors.')
			}
		}).catch((err) => {
			console.error(err)
		})
	}
}
