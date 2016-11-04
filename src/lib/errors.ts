import App from './app'

import MateriaError from './error'

export default class ErrorManager {
	errors: MateriaError[]
	warnings: MateriaError[]

	constructor(private app: App) {
		this.clear()
	}

	clear() {
		this.errors = []
		this.warnings = []
	}

	hasErrors():boolean { return !! this.errors.length }
	hasWarnings():boolean { return !! this.warnings.length }
	hasErrorsOrWarnings():boolean { return !! this.errors.length || !! this.warnings.length }


	addError(error: MateriaError|MateriaError[]) {
		this.errors = this.errors.concat(error)
	}

	addWarning(error: MateriaError|MateriaError[]) {
		this.warnings = this.warnings.concat(error)
	}
}