import { Field } from './field';

export interface IValidator {
	name: string,
	value: any
}

export class Validator {
	constructor(private field: Field, public name: string, public value: any) {
		console.log('validator', this.field, this.name);
	}

	toJson(): IValidator {
		return { name: this.name, value: this.value };
	}
}