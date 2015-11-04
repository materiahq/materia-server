'use strict';
var DBQuery = require('./base')

class CustomQuery extends DBQuery {
	constructor(entity, id, params, opts) {
		if ( ! opts.file) {
			throw 'missing required parameter "file"'
		}
		this.file = opts.file
		this.query = require(this.file)
	}

	run(params) {
		return this.query(this.entity.model, params)
	}

	toJson() {
		return {
			id: this.id,
			type: 'custom',
			params: this.params,
			opts: {
				file: this.file
			}
		}
	}
}

module.exports = CustomQuery
