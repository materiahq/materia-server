export interface ExceptionData {
	error: boolean,
	code: number,
	docs: string,
	message: string
}

export interface ExceptionBuilder {
	code: number,
	message: string,
	permalink: string,
	extra?: string
}

function materiaException(obj: ExceptionBuilder): ExceptionData {
	return {
		error: true,
		code: obj.code,
		docs: 'https://error.materia.com/' + obj.permalink,
		message: obj.message
	};
}

export class FileException {
	openFail(path: string, message: string): ExceptionData {
		return materiaException({
			code: 101,
			message: `Impossible to open the file ${path}: ${message}`,
			permalink: `file-exception-open?path=${path}&message=${message}`
		});
	}
	writeFail(path: string, message: string) {
		return materiaException({
			code: 102,
			message: `Impossible to write in file ${path}`,
			extra: message,
			permalink: `file-exception-write?path=${path}&message=${message}`
		});
	}
}

export class EntityException {
	duplicateEntity(entity: string) {
		return materiaException({
			code: 201,
			message: `Duplicate entity ${entity}`,
			permalink: `file-exception-entity?name=${entity}`
		});
	}
}

exports.FileException = FileException;
