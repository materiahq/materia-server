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
		this.entity.addQuery('get', 'findOne', [this.paramPK], {conditions: conditions})

		let params = []
		let values = {}
        let updateValues = {}
		this.entity.getFields().forEach((field) => {
			if (field.write) {
				params.push({ name: field.name, type: field.type, required: field.required })
				values[field.name] = '='
                if (field.name == this.pk.name) {
                    updateValues[field.name] = '=new' + this.pk.name
                }
                else {
                    updateValues[field.name] = '='
                }
			}
		})
        this.entity.getRelations().forEach((relation) => {
            console.log(relation);
        })

		this.entity.addQuery( 'create', 'create', params, {
			values: values
		})

		let paramsUpdate = []
		params.forEach((param) => {
			paramsUpdate.push(param)
		})
		paramsUpdate.push({
			name: 'new' + this.pk.name,
			type: this.pk.type,
			required: true
		})

        console.log('update', paramsUpdate, values, conditions)

		this.entity.addQuery('update', 'update', paramsUpdate, {
			values: updateValues,
			conditions: conditions
		})

		this.entity.addQuery('delete', 'delete', [this.paramPK], {
			conditions: conditions
		})
	}
}

module.exports = QueryGenerator
