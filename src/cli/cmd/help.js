'use strict'

let pckg_info = require('../../../package.json')

let topics = {
	'-': [
		'Usage: materia <command>',
		'',
		'Available commands:',
		'    start, relink, version',
		'',
		'materia help <cmd>\tdisplay help on <cmd>',
		'materia --version\tdisplay materia version'
	],
	'help': [
		'Usage:',
		'  materia help <command>',
		'  materia <command> --help',
		'  materia <command> -h',
		'',
		'Display help about <command>',
		'',
		'Available commands:',
		'    start, relink, version',
		'',
		'materia --version\tdisplay materia version'
	],
	'start': [
		'Usage: materia start [--mode=prod]',
		'',
		'Start a materia app.',
		'',
		'  --mode=prod\tStart the application in production mode.'
	],
	'relink': [
		'Usage: materia relink',
		'',
		'relink packages listed in the `links` section of materia.json.',
		'',
	],
	'version': [
		'Usage:',
		'  materia version',
		'  materia --version',
		'  materia -v',
		'',
		'Display the materia version'
	]
}

function displayTopic(topic, fallback) {
	let content = topics[topic]
	if ( ! content)
		return displayTopic(fallback || '-')
	console.log('')
	for (let line of content)
		console.log(line)
	console.log('')
	console.log('version ' + pckg_info.name + '@' + pckg_info.version.yellow)
}

module.exports = {
	matches: (args, options) => {
		return options.help || options.h || args.length == 0 || args[0] == 'help'
	},

	exec: (args, options) => {
		if (args.length == 0)
			displayTopic('-')
		else if (args[0] == 'help') {
			displayTopic(args[1], 'help')
		} else if (options.help || options.h) {
			displayTopic(args[0], 'help')
		}
	},

	display: (cmd) => {
		displayTopic(cmd)
	}
}
