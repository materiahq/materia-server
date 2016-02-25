'use strict';

class Permissions {
	constructor(app) {
		this.app = app
		this.filters = {}
	}

	check(permissions) {
		let self = this
		return function checkPermissions(req, res, next) {
			let chain = (req, res, next) => { next() }
			let rev_permissions = permissions.reverse()
			for (let perm of rev_permissions) {
				let filter = self.filters[perm]
				if ( ! filter)
					return next(new Error('Could not find addon for permission "' + perm + '"'))
				let nextchain = chain
				chain = (req, res, next) => {
					let _next = (e) => {
						if (e)
							return res.status(500).json(JSON.stringify(e.message)); // return next(e)
						nextchain(req, res, next)
					}
					filter(req, res, _next)
				}
			}
			chain(req,res,next)
		}
	}

	findAll() {
		return Object.keys(this.filters)
	}

	set(name, middlewareFn) {
		this.filters[name] = middlewareFn;
	}

	remove(name) {
		delete this.filters[name]
	}
}

module.exports = Permissions