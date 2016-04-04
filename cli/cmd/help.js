'use strict'

let pckg_info = require('../../package.json')

let topics = {
	'-': [
		'Usage: materia <command>',
		'',
		'Available commands:',
		'    addons, deploy, help, init, start, version',
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
		'    addons, deploy, help, init, start, version',
		'',
		'materia --version\tdisplay materia version'
	],
	'addons': [
		'Usage: materia addons <subcommand>',
		'',
		'Sub-commands:',
		'',
		'materia addons install [<package>]\tInstall a specified addon or all addons described in materia.json',
		'materia addons update [<package>]\tUpdate a specified addon or all addons described in materia.json',
		'materia addons remove <package>\t\t\Remove an addon',
		'materia addons search <query>\t\t\Remove an addon',
		'',
		'A package must be an installable package by npm:',
		'See https://docs.npmjs.com/cli/install for more informations'
	],
	'deploy': [
		'Usage: matera deploy <provider> [--<provider-param>=<value>]',
		'',
		'Available providers and parameters:',
		'',
		'dockerfile',
		'  Generates a Dockerfile and docker-compose.yml',
		'',
		'heroku',
		'  Required programs: docker, heroku, heroku-docker plugin',
		'  --heroku-app=<app>\t\t\tSpecifies the heroku app to use.',
		'',
		'aws',
		'  Required progams: docker, aws, ecs-cli',
		'  --aws-region=<region>\t\t\tSpecifies the AWS region to use.',
		'  --aws-cluster=<cluster>\t\tSpecifies the ECS cluster name to use. If the cluster does not exist, it is created when you try to deploy.',
		'                         \t\tDefaults to <app-name>-cluster',
		'  --aws-size=<size\t\t\tSpecifies the number of instances to launch and register to the cluster. Defaults to 1.',
		'  --aws-ecr=<ecr>\t\t\tSpecifies the ECR url to use when pushing docker.',
		'  --aws-keypair=<keypair>\t\tSpecifies the name of an existing Amazon EC2 key pair to enable SSH access to the EC2 instances in your cluster.',
		'  --aws-image=<image-name>\t\tSpecifies the name of the image to create and push on ECR. Defaults to <app-name>-image',
		'  --aws-instance-type=<instance-type>\tSpecifies the EC2 instance type for your container instances. Defaults to t2.micro',
	],
	'init': [
		'Usage: materia init',
		'',
		'Initialize a new materia app'
	],
	'start': [
		'Usage: materia start [--runtimes=all]',
		'',
		'Start a materia app.',
		'',
		'  --runtimes=all\tLoad app with all modules. This will enable materia tools and will try to install the missing addons when starting the app.'
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
