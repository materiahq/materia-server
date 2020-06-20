'use strict'
const execa = require('execa');
const path = require('path');
const inquirer = require('inquirer');
const which = require('which');
const chalk = require('chalk');

module.exports = {
	matches: (args, options) => {
		return args[0] == 'generate';
	},

	exec: async (args, options) => {
		if (args[1] === 'addon') {
			const addonArgs = ['@materia/schematics-addons:new'];
			let questions = [];
			let name;
			if (options && options.name) {
				name = options.name;
				addonArgs.push(`--name=${options.name}`);
			} else {
				questions = [{
					type: 'input',
					name: 'name',
					message: 'Enter an addon name: ',
					default: 'addon-boilerplate'
				}];
				const answers = await inquirer.prompt(questions);
				name = answers.name;
				addonArgs.push(`--name=${answers.name}`);
			}
			if (options && options.packageName) {
				addonArgs.push(`--packageName=${options.packageName}`);
			} else {
				questions = [{
					type: 'input',
					name: 'packageName',
					message: 'Enter a package name: ',
					default: name
				  }];
				 const answers = await inquirer.prompt(questions);
				 addonArgs.push(`--packageName=${answers.packageName}`);
			}
			if (options && options.prefix) {
				addonArgs.push(`--prefix=${options.prefix}`);
			}
			console.log(`Start generating addon: ${name}`);
			if (which.sync('schematics', { nothrow: true})) {
				const proc = execa('schematics', addonArgs);
				proc.stdout.on('data', (data) => console.log(data.toString()));
				proc.stderr.on('data', (data) => console.log(data.toString()));
			} else {
				console.error(chalk.red(chalk.bold(`ERROR: `) + `Need to install 'schematics' globally
npm install -g @angular-devkit/schematics-cli`));
			}
		} else {
			console.error(chalk.red(chalk.bold(`ERROR: `) + `Could not generate with unknown argument: ${args[1]}`));
		}
	}
}
