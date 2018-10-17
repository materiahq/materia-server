'use strict'

let pckg_info = require('../../package.json')

module.exports = {
	matches: (args, options) => {
		return args[0] == 'version' || options.version || options.v
	},

	exec: (args, options) => {
		console.log(pckg_info.name + ' ' + pckg_info.version.yellow)
	}
}