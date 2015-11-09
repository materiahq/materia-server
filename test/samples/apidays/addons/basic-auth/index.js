'use strict';

var userEntityConfig = require('./entity/user')
var userRoleEntityConfig = require('./entity/user_role')
var userAuthQuery = require('./query/auth')

class BasicAuth {
	constructor(app, config) {
		this.app = app

		console.log('------------------------- BasicAuth ---')

		let user = this.app.entities.get('user')
		if ( ! user)
			user = this.app.entities.add(userEntityConfig);

		let user_role = this.app.entities.get('user_role')
		if ( ! user_role)
			user_role = this.app.entities.add(userRoleEntityConfig);

		app.api.permissions.addFilter((permissions, req, res) => {
			return new Promise(function(accept, reject) {
				var needPerm;
				for (var perm of permissions) {
					if (perm.substr(0,9) == 'needAuth:')
						needPerm = perm.substr(9);
				}
				if ( ! needPerm)
					return accept();
				if ( ! req.session.auth)
					return reject(new Error("unauthorized"));
				user_role.getQuery('getUserRoles').run({
					id_user: req.session.auth.id
				}).then(function(roles) {
					for (var role of roles) {
						if (role.role == needPerm)
							return accept();
					}
					return reject(new Error("unauthorized"));
				}).catch(function(e) {
					return reject(e);
				})
			})
		})

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