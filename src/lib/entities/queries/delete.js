'use strict';

var Query = require('../query')
var Conditions = require('./utils/conditions')

class DeleteQuery extends Query {
	constructor(entity, id, params, data) {
		super(entity, id, params)
		this.type = 'delete'
		if ( ! data ) {
			data = {}
		}
		this.conditions = new Conditions(data.conditions, entity)
	}
	run(params) {
		let sequelizeCond = this.conditions.toSequelize(params)
		//console.log('delete on condition', sequelizeCond)
		return this.entity.model.destroy({ where: sequelizeCond })
	}

	toJson() {
		let res = {
			id: this.id,
			type: 'delete',
			params: this.params,
			opts: {
				conditions: this.conditions.toJson()
			}
		}
		return res
	}
}

module.exports = DeleteQuery
