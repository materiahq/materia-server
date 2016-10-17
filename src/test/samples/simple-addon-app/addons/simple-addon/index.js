'use strict';

class SimpleAddon {
	constructor(app) {
		this.app = app
		this.displayName = 'Simple Addon'
	}

	load() {
		return this.app.api.add({
			method: "get",
			url: "/hello",
			file: "../addons/simple-addon/simpleQuery",
			ext: "js"
		})
	}
}

module.exports = SimpleAddon
