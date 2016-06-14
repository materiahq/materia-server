'use strict';

/**
 * @class Permissions
 * @classdesc
 * This class is used to set filters to the endpoints.
 */
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

	/**
	Get all the registered filters' name
	@returns {Array<string>}
	*/
	findAll() {
		return Object.keys(this.filters)
	}

	/**
	Get a filter's function
	@param {string} - The filter name
	@returns {function}
	*/
	get(name) {
		return this.filters[name]
	}

	/**
	Set a filter.
	@param {string} - The filter name
	@param {function} - The function to execute when an endpoint uses this filter
	*/
	set(name, middlewareFn) {
		this.filters[name] = middlewareFn
	}

	/**
	Remove a filter
	@param {string} - The filter name
	*/
	remove(name) {
		delete this.filters[name]
	}
}

module.exports = Permissions