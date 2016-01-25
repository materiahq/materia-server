'use strict';
class QueryGenerator {
	constructor(entity) {
		this.entity = entity
		this.pk = this.entity.getPK()

		this.paramPK = {
			name: this.pk.name,
			type: this.pk.type,
			required: true
		}
	}

	generateQueries() {
		let conditions = [
			{
				name: this.pk.name,
				operator: '=',
				value: '='
			}
		]

		this.entity.addQuery('list', 'findAll')
		this.entity.addQuery('findOne', 'findOne', [this.paramPK], {conditions: conditions})

		let params = []
		let values = {}
		this.entity.getFields().forEach((field) => {
			if (field.write) {
				params.push({ name: field.name, type: field.type, required: field.required })
				values[field.name] = '='
			}
		})

		this.entity.addQuery( 'create', 'create', params, {
			values: values
		})

		let paramsUpdate = new Set()
		params.forEach((param) => {
			paramsUpdate.add(param)
		})
		paramsUpdate.add(this.paramPK)

		this.entity.addQuery('update', 'update', paramsUpdate, {
			values: values,
			conditions: conditions
		})

		this.entity.addQuery('delete', 'delete', [this.paramPK], {
			conditions: conditions
		})
	}
}

module.exports = QueryGenerator
