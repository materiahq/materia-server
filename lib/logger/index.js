'use strict';

class Logger {
	constructor(app) {
		this.app = app
	}

	log() {
		if (this.app.mode == 'dev') {
			console.log(args.join(' '))
		}
		else if (this.app.mode == 'prod') {
			//write to fs
		}
	}

	err() {

	}

	debug() {

	}

	test() {

	}
}

module.exports = Logger
