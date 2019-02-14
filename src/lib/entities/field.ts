import * as Sequelize from 'sequelize';
import { IField, IFieldReference } from '@materia/interfaces';

import { Entity } from './entity';
import { MateriaError } from '../error';
import { Validator } from './validator';

export const DefaultComponent = Object.freeze({
	text: 'input',
	number: 'input',
	date: 'datePicker',
	float: 'input',
	boolean: 'switch'
});

export const FieldType = Object.freeze({
	TEXT: 'text',
	NUMBER: 'number',
	DATE: 'date',
	FLOAT: 'float',
	BOOL: 'boolean'
	// URL: 'url'
	// COUNTER: 'counter',
	// IMAGE: 'image',
	// FILE: 'file',
	// STRING: 'string',
});

export class Field {
	name: string;
	type: string;
	primary: boolean;
	unique: boolean | string;
	required: boolean;
	default: boolean;
	defaultValue: any;
	autoIncrement: boolean;
	onUpdate: string;
	onDelete: string;

	title: boolean;
	component: string;

	read: boolean;
	write: boolean;

	isRelation: any;
	references: IFieldReference;

	validators: Array<any>;

	constructor(private entity: Entity, field: IField) {
		if ( ! field || ! field.name) {
			throw new MateriaError('A field must have a name');
		} else {
			this.name = field.name;
			this.required = field.required || false;
			this.primary = field.primary || false;
			this.unique = field.unique || false;
			this.default = field.default || false;
			this.onUpdate = field.onUpdate;
			this.onDelete = field.onDelete;
			if (field.default && field.defaultValue != undefined) {
				this.defaultValue = field.defaultValue;
				if (field.type === 'date' && field.defaultValue === 'now()') {
					this.defaultValue = Sequelize.NOW;
				}
			}
			this.type = field.type || FieldType.TEXT;
			if (this.type == 'string') {
				this.type = FieldType.TEXT;
			}
			this.autoIncrement = false;
			if (this.type.toLowerCase() == FieldType.NUMBER && field.autoIncrement) {
				this.autoIncrement = true;
			}

			this.title = field.title || false;
			this.component = field.component || DefaultComponent[this.type];

			// TODO: need more test on read/write
			this.read = field.read;
			this.write = field.write;

			this.isRelation = field.isRelation || false;

			this.validators = [];
			if (field.validators) {
				field.validators.forEach((validator) => {
					this.addValidator(validator.name, validator.value);
				});
			}
		}
	}

	setDefaultValue(): void {
		this.type = 'text';
		this.required = false;
		this.primary = false;
		this.unique = false;
		this.read = true;
		this.write = true;
		this.default = false;
		this.title = false;
		delete this.onUpdate;
		delete this.onDelete;
		if (this.defaultValue) { delete this.defaultValue; }
		if (this.autoIncrement) { delete this.autoIncrement; }
	}

	toJson(): IField {
		// let validatorsJson = []
		// for i of this.validators
		// 	validatorsJson.push validators[i].toJson()

		const res: IField = {
			name: this.name,
			type: this.type,
			read: this.read,
			write: this.write
		};

		if (this.primary) {
			res.primary = this.primary;
		}

		if (this.unique) {
			res.unique = this.unique;
		}

		if (this.required) {
			res.required = this.required;
		}

		if (this.default) {
			res.default = this.default;
		}

		if (this.default && this.defaultValue != undefined) {
			res.defaultValue = this.defaultValue;
			if (this.defaultValue === Sequelize.NOW) {
				res.defaultValue = 'now()';
			}
		}

		if (res.default && res.defaultValue != undefined) {
			if (this.defaultValue == 'true' && this.type.toLowerCase() == 'boolean') {
				res.defaultValue = true;
			}
			if (this.defaultValue == 'false' && this.type.toLowerCase() == 'boolean') {
				res.defaultValue = false;
			}
			if (this.type.toLowerCase() == 'number') {
				res.defaultValue = Number(this.defaultValue);
				if (res.defaultValue == NaN) {
					res.defaultValue = 0;
				}
			}
		}

		if (this.autoIncrement) {
			res.autoIncrement = true;
		}

		if (this.title && this.type == FieldType.TEXT) {
			res.title = true;
		}

		if (this.component) {
			res.component = this.component;
		}

		if (this.onUpdate) {
			res.onUpdate = this.onUpdate;
		}

		if (this.onDelete) {
			res.onDelete = this.onDelete;
		}

		return res;
	}

	isDefaultRelationField(): boolean {
		return this.required
			&& ! this.unique
			&& ! this.primary
			&& ! this.default
			&& ( ! this.onUpdate || this.onUpdate.toUpperCase() == 'CASCADE')
			&& ( ! this.onDelete || this.onDelete.toUpperCase() == 'CASCADE');
	}

	// Not Used
	fillDefault(): void {
		this.required = this.required || false;
		this.primary = this.primary || false;
		this.unique = this.unique || false;
		this.default = this.default || false;
		this.type = this.type || FieldType.TEXT;
		if (this.autoIncrement == undefined && this.type.toLowerCase() == FieldType.NUMBER && this.primary) {
			this.autoIncrement = true;
		}
		this.read = this.read || true;
		this.write = this.write || true;
		this.isRelation = this.isRelation || false;
	}

	update(field: IField): void {
		if (this.name != field.name && ! this.entity.isField(field.name)) {
			this.name = field.name;
		}
		this.type = field.type;
		this.required = field.required;
		this.primary = field.primary;
		this.unique = field.unique;
		this.write = field.write;
		this.default = field.default;
		this.defaultValue = field.defaultValue;
		this.autoIncrement = field.autoIncrement;
		this.title = field.title;
		this.component = field.component;
		this.onUpdate = field.onUpdate;
		this.onDelete = field.onDelete;
	}

	setType(type: string): boolean {
		for (const t in FieldType) {
			if (FieldType[t] == type) {
				this.type = type;
				this.component = DefaultComponent[type];
				return true;
			}
		}
		return false;
	}

	addValidator(name: string, value: any): void {
		this.validators.push(new Validator(this, name, value));
	}

	removeValidator(name: string): boolean {
		let id = -1;
		this.validators.forEach((validator, k) => {
			if (validator.name == name) {
				id = k;
			}
		});
		if (id !== -1) {
			this.validators.splice(id, 1);
			return true;
		}
		return false;
	}
}