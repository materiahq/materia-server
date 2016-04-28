'use strict';
var Endpoint = require('./api/endpoint')
var Permissions = require('./api/permissions')

var fs = require('fs')
var path = require('path')
var _ = require('lodash')

class Api {
	constructor(app) {
		this.app = app
		this.endpoints = []
		this.DiffType = this.app.history.DiffType
		this.permissions = new Permissions(app)
	}

	exists(endpoint) {
		let find = false
		this.endpoints.forEach((e) => {
			if (endpoint.method == e.method && endpoint.url == e.url) {
				find = true
			}
		})
		return find
	}

	add(endpoint, options) {
		options = options || {}
		if (endpoint) {
			if (this.exists(endpoint)) {
				this.remove(endpoint.method, endpoint.url)
			}
			this.endpoints.push(new Endpoint(this.app, endpoint))
			if (options.save != false) {
				this.save(options)
			}
		}
	}

	put(endpoint, pos, options) {
		options = options || {}
		this.endpoints[pos] = new Endpoint(this.app, endpoint)
		if (options.save != false) {
			this.save(options)
		}
	}

	remove(method, url, options) {
		options = options || {}
		for (let i in this.endpoints) {
			let endpoint = this.endpoints[i]
			if (endpoint.url == url && endpoint.method == method) {
				this.endpoints.splice(i, 1)
				if (options.save != false) {
					this.save(options)
				}
				return
			}
		}
	}

	get(method, url) {
		for (let endpoint of this.endpoints) {
			if (endpoint.url == url && endpoint.method == method) {
				return endpoint
			}
		}
	}

	findAll() { return this.endpoints }

	load() {
		this.endpoints = []

		try {
			let content = fs.readFileSync(path.join(this.app.path, 'api.json'))
			let endpoints = JSON.parse(content.toString())

			endpoints.forEach((endpoint) => {
				try {
					this.add(endpoint, {save: false})
				} catch (e) {
					console.log('Skipped endpoint ' + endpoint.method + ' ' + endpoint.url)
					console.log('due to error ' + e.message)
				}
			})
		} catch (e) {
			if (e.code != 'ENOENT')
				console.error('error loading endpoints', e.stack)
			else
				throw e
		}
	}

	registerEndpoints(appServer) {
		//console.log '\nSetup API...'
		this.endpoints.forEach((endpoint) => {
			//console.log(endpoint.method.toUpperCase() + ' ' + endpoint.url)
			let route = appServer[endpoint.method.toLowerCase()]
			//console.log(route)
			route.call(appServer, '/api' + endpoint.url, this.permissions.check(endpoint.permissions), (req, res) => {
				endpoint.handle(req, res)
			})
		})
	}

	toJson() {
		let res = []
		this.endpoints.forEach((endpoint) => {
			res.push(endpoint.toJson())
		})
		return res
	}

	save(opts) {
		if (opts && opts.beforeSave) {
			opts.beforeSave()
		}
		fs.writeFileSync(path.join(this.app.path, 'api.json'), JSON.stringify(this.toJson(), null, '\t'))
		if (opts && opts.afterSave) {
			opts.afterSave()
		}
	}
}

module.exports = Api
