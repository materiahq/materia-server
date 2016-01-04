'use strict';

class SimpleAddon {
	constructor(app) {
		this.app = app
		this.displayName = 'Simple Addon'
	}

	load() {
		this.app.api.add().get("/hello", (req, res) => {
			res.status(200).send('Hello World!!')
		})
	}
}

module.exports = SimpleAddon
