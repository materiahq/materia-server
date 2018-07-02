'use strict'

const fs = require('fs');
const path = require('path');
const { Npm } = require('../../api/lib/npm');
const cwd = process.cwd();
const chalk = require('chalk');

module.exports = {
	matches: (args, options) => {
		return args[0] == 'relink'
	},

	exec: (args, options) => {
		try {
			const materiaJson = JSON.parse(fs.readFileSync(path.join(cwd, 'materia.json'), 'utf-8'))
			if (materiaJson.links && materiaJson.links.length > 0) {
				const npm = new Npm(cwd, true);

				let p = Promise.resolve();
				materiaJson.links.forEach(link => {
					p = p.then(() => npm.exec('link', [link]))
				})
				p.then(() => {
					console.log(`Packages ${chalk.bold(materiaJson.links.join(', '))} relinked ${chalk.bold.green('successfully')}.`)
				}).catch(() => {
					console.log(chalk.bold.red(`Error: Impossible to relink packages.\n${e.message}`))
				})
			}
		}
		catch(e) {
			console.error(e)
		}
	}
}