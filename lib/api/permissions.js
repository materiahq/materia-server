'use strict';

class Permissions {
	constructor(app) {
		this.app = app;
		this.permissions = []
	}

	get(name) {
		let find = false
		this.permissions.forEach((permission) => {
			if (permission.name == name) {
				find = permission
			}
		})
		return find
	}

	exists(name) {
		return this.get(name) !== false
	}

	check(permissions) {
		let permissionCallbacks = []
		if ( ! permissions) {
			permissions = []
		}

		if ( ! Array.isArray(permissions)) {
			permissions = [permissions]
		}
		permissions.forEach((perm) => {
			let permission = this.get(perm)
			permissionCallbacks.push(permission.callback)
		})

		return (req, res, next) => {
			permissionCallbacks.forEach((cb) => {
				cb(req, res, next);
			})
		}
	}

	add(name, callback) {
		if (this.exists(name)) {
			this.remove(name)
		}
		this.permissions.push({
			name: name,
			permission: callback
		})
	}

	remove(name) {
		let find = false
		this.permissions.forEach((permission, i) => {
			if (permission.name == name) {
				this.permissions.splice(i, 1);
				find = true
			}
		})
		return find
	}
}
