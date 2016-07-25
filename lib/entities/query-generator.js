'use strict';
class QueryGenerator {
	constructor(entity) {
		this.entity = entity
		this.pk = this.entity.getPK()
		if (this.pk.length) {
			this.paramsPK = []
			for (let pk of this.pk) {
				this.paramsPK.push({
					name: pk.name,
					type: pk.type,
					required: true
				})
			}
		}
		this.paramsPagination = [{
			name: 'page',
			type: 'number',
			required: false
		}, {
			name: 'limit',
			type: 'number',
			required: false
		}]
	}

	generateQueries() {
		let conditions = []
		for (let pk of this.pk) {
			conditions.push({
				name: pk.name,
				operator: '=',
				value: '=',
				operand: "and"
			})
		}

		this.entity.addDefaultQuery('list', 'findAll', this.paramsPagination, {
			page: '=',
			limit: '='
		})

		if (this.pk.length) {
			this.entity.addDefaultQuery('get', 'findOne', this.paramsPK, {conditions: conditions})
		}

		let params = []
		let values = {}
		let updateValues = {}
		let paramsUpdate = []

		let getUpdateValue = (field) => {
			for (let pk of this.pk) {
				if (field.name == pk.name) {
					return '=new_' + field.name
				}
			}
			return '='
		}

		this.entity.getFields().forEach((field) => {
			if (field.write && ! field.autoIncrement) {
				params.push({ name: field.name, type: field.type, required: field.required })
				values[field.name] = '='
				updateValues[field.name] = getUpdateValue(field)
			}
			else if (field.autoIncrement) {
				paramsUpdate.push({ name: field.name, type: field.type, required: field.required })
				updateValues[field.name] = getUpdateValue(field)
			}
		})

		this.entity.addDefaultQuery( 'create', 'create', params, {
			values: values
		})

		if (this.pk.length) {
			params.forEach((param) => {
				let newParam = {
					name: param.name,
					type: param.type,
					required: false
				}
				paramsUpdate.push(newParam)
			})

			for (let pk of this.pk) {
				paramsUpdate.push({
					name: 'new_' + pk.name,
					type: pk.type,
					required: false
				})
			}

			this.entity.addDefaultQuery('update', 'update', paramsUpdate, {
				values: updateValues,
				conditions: conditions
			})

			this.entity.addDefaultQuery('delete', 'delete', this.paramsPK, {
				conditions: conditions
			})
		}
	}
}

module.exports = QueryGenerator
