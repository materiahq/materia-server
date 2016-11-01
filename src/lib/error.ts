interface IErrorOptions {
	slug?: string
	issue?: number
	debug?: string
}

export default class MateriaError extends Error {
	slug: string
	issue: number
	debug: string

	constructor(message, options?:IErrorOptions) {
		super(message)
		this.slug = options.slug
		this.issue = options.issue
		this.debug = options.debug
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