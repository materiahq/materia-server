'use strict';

let userEntityConfig = require('./entity/user')
let userRoleEntityConfig = require('./entity/user_role')
let userPermissionEntityConfig = require('./entity/user_permission')

let userApiEndpoints = require('./endpoints')

class BasicAuth {
	constructor(app, config) {
		this.app = app

		this.user = undefined
		this.user_role = undefined
		this.user_permissions = undefined
	}

	_addDefaultRoles() {
		return this.user_role.getQuery('get').run('admin').then((def) => {
			if (def)
				return Promise.resolve()
			return this.user_role.getQuery('create').run({
				role: 'admin',
				description: 'Administrator'
			})
		})
	}

	_setPermissions() {
		let self = this

		return this.user_role.getQuery('list').run().then((roles) => {
			let handler = (role) => {
				return function needAuthRole(req, res, next) {
					if ( ! req.session || ! req.session.auth)
						return next(new Error("Unauthorized"))
					self.user_permissions.getQuery('get').run({
						id_user: req.session.auth.id,
						role: role
					}).then((hasPerm) => {
						if (hasPerm)
							return next()
						return next(new Error("Unauthorized"))
					}).catch(function(e) {
						return next(e)
					})
				}
			}

			for (let role of roles) {
				this.app.api.permissions.set('needAuth:' + role.role, handler(role.role))
			}

			this.app.api.permissions.set('needAuth', function needAuth(req, res, next) {
				if ( ! req.session || ! req.session.auth)
					return next(new Error("Unauthorized"))
				next()
			})
		})
	}

	start() {
		let fillDefaultRoles = ! this.app.entities.get('user_role')
		return Promise.all([
			this.app.entities.getOrAdd('user', userEntityConfig, {history:false}),
			this.app.entities.getOrAdd('user_role', userRoleEntityConfig, {history:false}),
			this.app.entities.getOrAdd('user_permission', userPermissionEntityConfig, {history:false})
		]).then((auth_entities) => {
			this.user = auth_entities[0]
			this.user_role = auth_entities[1]
			this.user_permissions = auth_entities[2]

			let addDefaultRoles = fillDefaultRoles ? this._addDefaultRoles() : Promise.resolve()
			return addDefaultRoles.then(() => {
				return this._setPermissions()
			}).then(() => {
				for (let endpoint of userApiEndpoints) {
					this.app.api.add(endpoint)
				}
				return Promise.resolve()
			})
		})
	}
}

module.exports = BasicAuth