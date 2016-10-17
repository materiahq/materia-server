#! /usr/bin/env node

'use strict'

let argv = require('minimist')(process.argv.slice(2))
let colors = require('colors')

let help = require('./cmd/help')
let cmds = [
	require('./cmd/version'),
	help,

	require('./cmd/addons'),
	require('./cmd/deploy'),
	require('./cmd/init'),
	require('./cmd/start'),
]

let args = argv._
let options = argv

options['database-host'] = options['database-host'] || process.env.MATERIA_DATABASE_HOST
options['database-port'] = options['database-port'] || process.env.MATERIA_DATABASE_PORT
options['database-username'] = options['database-username'] || process.env.MATERIA_DATABASE_USERNAME
options['database-db'] = options['database-db'] || process.env.MATERIA_DATABASE_DB
options['mode'] = options['mode'] || process.env.MATERIA_MODE
options['port'] = options['port'] || process.env.PORT

let match
for (let cmd of cmds) {
	match = cmd.matches(args, options)
	if (match === 1) {
		help.display(args[0])
		break
	}
	else if (match) {
		cmd.exec(args, options)
		break
	}
}

if ( ! match) {
	console.error('Unknown command: ' + args[0])
	help.display()
}