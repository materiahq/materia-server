'use strict'

module.exports = {
	matches: (args, options) => {
		return args[0] == 'init'
	},

	exec: (args, options) => {
		console.log('Initialize ' + 'materia'.yellow + ' in the current directory')
	}
}