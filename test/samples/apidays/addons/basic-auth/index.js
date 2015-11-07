'use strict';

var userEntityConfig = require('./entity/user')
var userAuthQuery = require('./query/auth')

class BasicAuth {
	constructor(app, config) {
		this.app = app

		console.log('------------------------- BasicAuth ---')

//		if (config.entity && config.entity.user) {
//		}
		let user = this.app.entities.get('user')
		if (user) {
		}
		else {
			user = this.app.entities.add(userEntityConfig);
		}

		app.api.add({
			"method": "post",
			"url": "/auth",
			"params": [],
			"data": [],
			"query": {
				"entity": "user",
				"id": "auth"
			}
		})
	}
}

module.exports = BasicAuth