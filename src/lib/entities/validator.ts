import { Field } from './field'

export interface IValidator {
	name: string,
	value: any
}

export class Validator {
	constructor(private field: Field, public name: string, public value: any) {}

	toJson(): IValidator {
		return { name: this.name, value: this.value }
	}
}