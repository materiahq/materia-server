'use strict';

var Query = require('../query')

class CustomQuery extends Query {
	constructor(entity, id, params, opts) {
		super(entity, id, params);
		if ( ! opts || ! opts.file)
			throw new Error('missing required parameter "file"')

		this.file = opts.file
		try {
			this.query = require(entity.app.path + '/' + this.file)
		} catch(e) {
			let err = new Error('Could not load query ' + this.file + ' in entity ' + entity.name)
			err.originalError = e
			throw err
		}
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
