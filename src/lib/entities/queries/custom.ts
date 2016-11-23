'use strict';

import { Query } from '../query'
import * as fs from 'fs'
import * as path from 'path'

export class CustomQuery extends Query {
	type: string
	file: string
	query: any
	queryStr: string

	constructor(entity, id, params, opts) {
		super(entity, id, params);

		this.type = 'custom'

		if ( ! opts || ! opts.file)
			throw new Error('missing required parameter "file"')

		this.file = opts.file


		let basepath = entity.app.path
		if ( entity.fromAddon ) {
			basepath = path.join(entity.app.path, 'addons', entity.fromAddon)
		}
		try {
			if (require.cache[require.resolve(path.join(basepath, this.file))]) {
				delete require.cache[require.resolve(path.join(basepath, this.file))];
			}
			this.query = require(path.join(basepath, this.file))
			this.queryStr = fs.readFileSync(path.join(basepath, this.file + '.js'), 'utf8')
		} catch(e) {
			let err = new Error('Could not load query ' + this.file + ' in entity ' + entity.name) as any
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