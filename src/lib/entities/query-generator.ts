import { IQueryParam } from '@materia/interfaces';

import { Entity } from './entity';
import { Field } from './field';

export class QueryGenerator {
	pk: Array<Field>;
	paramsPK: Array<IQueryParam>;
	paramsPagination: Array<IQueryParam>;

	constructor(private entity: Entity) {
		this.pk = this.entity.getPK();

		if (this.pk.length) {
			this.paramsPK = [];
			for (const pk of this.pk) {
				this.paramsPK.push({
					name: pk.name,
					type: pk.type,
					required: true,
					component: 'input'
				});
			}
		}
		this.paramsPagination = [{
			name: 'page',
			type: 'number',
			required: false,
			component: 'input'
		}, {
			name: 'limit',
			type: 'number',
			required: false,
			component: 'input'
		}];
	}

	generateQueries() {
		const conditions = [];
		const orderBy = [];
		for (const pk of this.pk) {
			conditions.push({
				name: pk.name,
				operator: '=',
				value: '=',
				operand: 'and'
			});
			orderBy.push({
				field: pk.name,
				desc: false
			});
		}

		this.entity.addDefaultQuery('list', 'findAll', this.paramsPagination, {
			page: '=',
			limit: '=',
			orderBy: orderBy
		});

		if (this.pk.length) {
			this.entity.addDefaultQuery('get', 'findOne', this.paramsPK, {conditions: conditions});
		}

		const params: IQueryParam[] = [];
		const values = {};
		const updateValues = {};
		const paramsUpdate = [];

		const getUpdateValue = (field) => {
			for (const pk of this.pk) {
				if (field.name == pk.name) {
					return '=new_' + field.name;
				}
			}
			return '=';
		};

		this.entity.getFields().forEach((field) => {
			if (field.write && ! field.autoIncrement) {
				params.push({ name: field.name, type: field.type, required: field.required, component: field.component });
				values[field.name] = '=';
				updateValues[field.name] = getUpdateValue(field);
			} else if (field.autoIncrement) {
				paramsUpdate.push({ name: field.name, type: field.type, required: field.required, component: field.component });
				updateValues[field.name] = getUpdateValue(field);
			}
		});

		this.entity.addDefaultQuery( 'create', 'create', params, {
			values: values
		});

		if (this.pk.length) {
			params.forEach((param) => {
				const newParam = {
					name: param.name,
					type: param.type,
					required: false,
					component: param.component
				};
				paramsUpdate.push(newParam);
			});

			for (const pk of this.pk) {
				paramsUpdate.push({
					name: 'new_' + pk.name,
					type: pk.type,
					required: false,
					component: 'input'
				});
			}

			this.entity.addDefaultQuery('update', 'update', paramsUpdate, {
				values: updateValues,
				conditions: conditions
			});

			this.entity.addDefaultQuery('delete', 'delete', this.paramsPK, {
				conditions: conditions
			});
		}
	}
}