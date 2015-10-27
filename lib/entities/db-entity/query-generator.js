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

	generateQueries() {
		this.entity.addQuery('list', 'findAll')
		this.entity.addQuery('findOne', 'findOne', [this.paramPK], {
			conditions: [
				{
					field: this.pk,
					op: {
						sign: '=',
						display: 'Equals',
						value: '$eq'
					},
					valueType: 'param',
					//# TODO: change paramPK by paramPK.name (to not overload the JSON)
					value: this.paramPK
				}
			]
		})

		let params = []
		let values = []
		this.entity.getFields().forEach((field) => {
			if (field.write) {
				params.push({ name: field.name, type: field.type, required: field.required })
				values.push({ name: field.name, value: field })
			}
		})

		this.entity.addQuery( 'create', 'create', params, {
			values: values
		})

		let paramsUpdate = new Set()
		params.forEach((param) => {
			paramsUpdate.add(param)
		}
		paramsUpdate.add(this.paramPK)

		//console.log params
		this.entity.addQuery('update', 'update', paramsUpdate, {
			values: values,
			conditions: [
				{
					field: this.pk,
					op: {
						sign: '=',
						display: 'Equals',
						value: '$eq'
					},
					valueType: 'param',
					value: this.paramPK
				}
			]
		})

		this.entity.addQuery({ 'delete', 'delete', [this.paramPK], {
			conditions: [
				{
					field: this.pk,
					op: {
						sign: '=',
						display: 'Equals',
						value: '$eq'
					},
					valueType: 'param',
					value: this.paramPK
				}
			]
		})
	}
}

module.exports = QueryGenerator
