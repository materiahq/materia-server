'use strict';
var Endpoint = require('./endpoint')

var fs = require('fs')
var path = require('path')
var _ = require('lodash')

class Api {
	constructor(app) {
		this.app = app
		this.endpoints = []
	}

	add(endpoint) {
		this.endpoints.push(new Endpoint(this.app, endpoint))
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
		this.endpoints = []

		//this.generateApi()
		try {
			//console.log('API.... load ', path.join(this.app.path, 'api.json'))
			let content = fs.readFileSync(path.join(this.app.path, 'api.json'))
			let endpoints = JSON.parse(content)
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
			route.call(appServer, '/api' + endpoint.url, (req, res) => {
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
