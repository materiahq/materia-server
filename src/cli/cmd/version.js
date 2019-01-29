'use strict'

const pckg_info = require('../../package.json')
const chalk = require('chalk');

module.exports = {
	matches: (args, options) => {
		return args[0] == 'version' || options.version || options.v
	},

	exec: (args, options) => {
		console.log(pckg_info.name + ' ' + chalk.yellow(pckg_info.version))
	}
}