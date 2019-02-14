import { IErrorOptions } from '@materia/interfaces';

export class MateriaError extends Error {
	slug: string;
	issue: number;
	debug: string;
	originalError?: Error;

	constructor(message, options?: IErrorOptions) {
		super(message);
		if (options) {
			this.slug = options.slug;
			this.issue = options.issue;
			this.debug = options.debug;
			this.originalError = options.originalError;
		}
	}

	toString() {
		let message = this.message;

		if (this.slug) {
			message += `
Visit https://getmateria.com/error/${this.slug} for more information.`;
		}
		if (this.issue) {
			message += `
There is a Github Issue talking about it: https://github.com/webshell/materia-designer/issues/${this.issue}`;
		}

		if (this.debug) {
			message += `
Tips: ${this.debug}`;
		}

		return message;
	}
}