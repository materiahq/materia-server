'use strict';
var DBQuery = require('./base')
var Conditions = require('./utils/conditions')

class DeleteQuery extends DBQuery {
	constructor(entity, id, params, data) {
		super(entity, id, params)
		this.type = 'delete'
		if ( ! data ) {
			data = {}
		}
		this.conditions = new Conditions(data.conditions)
	}
	run(params) {
		//if ( ! this.entity.model ) {
		//	this.entity.loadModel()
		//}

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
