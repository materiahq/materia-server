'use strict';
class QueryGenerator {
	constructor(entity) {
		this.entity = entity
		this.pk = this.entity.getPK()
        if (this.pk) {
    		this.paramPK = {
                name: this.pk.name,
                type: this.pk.type,
                required: true
            }
        }
	}

	generateQueries() {
        if ( ! this.pk) {
            return false;
        }
		let conditions = [
			{
				name: this.pk.name,
				operator: '=',
				value: '='
			}
		]

		this.entity.addDefaultQuery('list', 'findAll')
		this.entity.addDefaultQuery('get', 'findOne', [this.paramPK], {conditions: conditions})

		let params = []
		let values = {}
        let updateValues = {}
		let paramsUpdate = []
		this.entity.getFields().forEach((field) => {
			if (field.write && ! field.autoIncrement) {
				params.push({ name: field.name, type: field.type, required: field.required })
				values[field.name] = '='
                if (field.name == this.pk.name) {
                    updateValues[field.name] = '=new' + this.pk.name
                }
                else {
                    updateValues[field.name] = '='
                }
			}
			else if (field.autoIncrement) {
				paramsUpdate.push({ name: field.name, type: field.type, required: field.required })
				updateValues[field.name] = '='
			}
		})
        this.entity.getRelations().forEach((relation) => {
            //console.log(relation);
        })

		this.entity.addDefaultQuery( 'create', 'create', params, {
			values: values
		})

		params.forEach((param) => {
			param.required = false
			paramsUpdate.push(param)
		})
		paramsUpdate.push({
			name: 'new' + this.pk.name,
			type: this.pk.type,
			required: false
		})

        //console.log('update', paramsUpdate, values, conditions)

		this.entity.addDefaultQuery('update', 'update', paramsUpdate, {
			values: updateValues,
			conditions: conditions
		})

		this.entity.addDefaultQuery('delete', 'delete', [this.paramPK], {
			conditions: conditions
		})
	}
}

module.exports = QueryGenerator
