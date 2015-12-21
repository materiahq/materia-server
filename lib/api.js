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

	add(endpoint) {
		if (endpoint) {
			if (this.exists(endpoint)) {
				this.remove(endpoint.method, endpoint.url)
			}
			this.endpoints.push(new Endpoint(this.app, endpoint))
		}
		else {
			let fn = (method, url, opts, callback) => {
				endpoint = {
					method: method,
					url: url
				}

				if (this.exists(endpoint)) {
					this.remove(endpoint.method, endpoint.url)
				}

				if ( ! callback && opts && typeof opts == 'function' ) {
					callback = opts
					opts = {}
				}

				endpoint.query = callback
				if (opts.params) {
					endpoint.params = opts.params
				}
				if (opts.data) {
					endpoint.data = opts.data
				}
				if (opts.permissions) {
					endpoint.permissions = opts.permissions
				}
				this.endpoints.push(new Endpoint(this.app, endpoint))
			}
			return {
				get: (url, opts, callback) => { fn('get', url, opts, callback) },
				post: (url, opts, callback) => { fn('post', url, opts, callback) },
				put: (url, opts, callback) => { fn('put', url, opts, callback) },
				del: (url, opts, callback) => { fn('del', url, opts, callback) },
				patch: (url, opts, callback) => { fn('patch', url, opts, callback) }
			}
		}
	}

	put(endpoint, pos) {
		this.endpoints[pos] = new Endpoint(this.app, endpoint)
	}

	remove(method, url) {
		this.endpoints.forEach((endpoint, i) => {
			if (endpoint.url == url && endpoint.method == method) {
				this.endpoints.splice(i, 1)
			}
		})
	}

	load() {
		//console.log('\nLoading endpoints...')
		//this.endpoints = []

		//this.generateApi()
		try {
			//console.log('API.... load ', path.join(this.app.path, 'api.json'))
			let content = fs.readFileSync(path.join(this.app.path, 'api.json'))
			let endpoints = JSON.parse(content.toString())
			//console.log(endpoints)
			//console.log 'Overload default endpoints with endpoints.json'
			endpoints.forEach((endpoint) => {
				/*let find = false
				this.endpoints.forEach((e2, i) => {
					if (e2.method == endpoint.method && e2.url == endpoint.url) {
						find = i
					}
				})
				if (find === false) {*/
				this.add(endpoint)
					/*
				}
				else {
					this.put(endpoint, find)
				}*/
			})
		} catch (e) {
			//console.log('not endpoint found')
			//console.log 'api.json not found: ', e
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

	save() {
		this.endpoints.forEach((endpoint) => {
			if (endpoint.queryType == 'custom') {
				fs.writeFileSync(path.join(this.app.path, 'customQueries', endpoint.query.id + '.js'), query)
			}
		})
		fs.writeFileSync(path.join(this.app.path, 'endpoints.json'), JSON.stringify(this.toJson(), null, 2))
	}
}

module.exports = Api
