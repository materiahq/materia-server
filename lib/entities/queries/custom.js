'use strict';

var Query = require('../query')
var fs = require('fs')
var path = require('path')

class CustomQuery extends Query {
	constructor(entity, id, params, opts) {
		super(entity, id, params);
		if ( ! opts || ! opts.file)
			throw new Error('missing required parameter "file"')

		this.file = opts.file
		try {
			if (require.cache[require.resolve(path.join(entity.app.path, this.file))]) {
				delete require.cache[require.resolve(path.join(entity.app.path, this.file))];
			}
			this.query = require(path.join(entity.app.path, this.file))
			this.queryStr = fs.readFileSync(path.join(entity.app.path, this.file + '.js'))
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
