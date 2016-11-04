export enum ErrorType {
	DATABASE,
	ENTITY,
	FIELD,
	RELATION,
	API,
	ENDPOINT
}

interface IErrorOptions {
	slug?: string
	issue?: number
	debug?: string
	type?: ErrorType
}

export default class MateriaError extends Error {
	slug: string
	issue: number
	debug: string
	type: ErrorType

	constructor(message:string, options?:IErrorOptions) {
		super(message)
		if (options) {
			this.slug = options.slug
			this.issue = options.issue
			this.debug = options.debug
			this.type = options.type
		}
	}

	toString() {
		let message = this.message

		if (this.slug) {
			message += `
Visit https://getmateria.com/error/${this.slug} for more information.`
		}
		if (this.issue) {
			message += `
There is a Github Issue talking about it: https://github.com/webshell/materia-designer/issues/${this.issue}`
		}

		if (this.debug) {
			message += `
Tips: ${this.debug}`
		}

		return message
	}
}