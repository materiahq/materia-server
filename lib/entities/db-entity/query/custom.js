'use strict';
var DBQuery = require('./base')

class CustomQuery extends DBQuery {
	constructor(entity, id, params, opts) {
		super(entity, id, params);
		if ( ! opts || ! opts.file) {
			throw 'missing required parameter "file"'
		}
		this.file = opts.file
		this.query = require(entity.app.path + '/' + this.file)
	}

	run(params) {
		return this.query(this.entity.model, params, this.entity.app);
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
