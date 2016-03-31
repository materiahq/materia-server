'use strict'

let App = require('../../lib/app')

function pipe_proc(proc) {
	new Promise((accept, reject) => {
		let gotStderr = false
		proc.on('error', (err) => { reject(err) })
		proc.stdout.on('data', (data) => { process.stdout.write(data) })
		proc.stderr.on('data', (data) => { process.stderr.write(data); gotStderr = true })
		proc.on('close', (code) => {
			// notice that we had some error text with gotStderr ?
			accept(code)
		})
	})
}

function action_all() {
	console.error('not implemented yet')
}

function action(proc, messages) {
	pipe_proc(proc).then((code) => {
		if (code == 0)
			console.log(messages.success)
		else {
			console.error(messages.failed)
			console.error(messages.code + code.toString().yellow)
		}
	}).catch((err) => {
		if (err.stdout)
			console.error(err.stdout)
		if (err.stderr)
			console.error(err.stderr)
		console.error(err.stack)
	})
}

module.exports = {
	matches: (args, options) => {
		if (args[0] == 'addons') {
			if (["install", "update", "remove", "search"].indexOf(args[1]) != -1) {
				if ( ! args[2] && (args[1] == "remove" || args[1] == "search"))
					return 1
				return true
			}
			return 1
		}
		return false
	},

	exec: (args, options) => {
		let cwd = process.cwd()
		let cmd = args[1]

		if (cmd == "search") {
			let AddonsTools = require('../../lib/runtimes/tools/addons')
			let addonsTools = new AddonsTools()
			addonsTools.search(args[2]).then((results) => {
				if ( ! results.length)
					return console.log('No addon found')
				console.log("Search results:")
				console.log("")
				for (let result of results) {
					console.log('\t' + result.name.cyan + '\t' + result.description)
				}
			}).catch((err) => {
				console.error(err.message.red)
			})
			return
		}

		let app = new App(cwd, options)
		if (cmd == "install") {
			if (args[2]) {
				action(app.addonsTools.install(args[2]), {
					success: 'Addon installed !',
					failed: 'Failed to install addon.',
					code: 'Addon install finished with return code: '
				})
			} else {
				action_all()
			}
		}
		else if (cmd == "update") {
			if (args[2]) {
				action(app.addonsTools.install(args[2]), {
					success: 'Addon updated !',
					failed: 'Failed to update addon.',
					code: 'Addon update finished with return code: '
				})
			} else {
				action_all()
			}
		}
		else if (cmd == "remove") {
			// ...
		}
	}
}