"use strict";
function materiaException(obj) {
    return {
        error: true,
        code: obj.code,
        docs: "https://error.materia.com/" + obj.permalink,
        message: obj.message
    };
}
class FileException {
    openFail(path, message) {
        return materiaException({
            code: 101,
            message: `Impossible to open the file ${path}: ${message}`,
            permalink: `file-exception-open?path=${path}&message=${message}`
        });
    }
    writeFail(path, message) {
        return materiaException({
            code: 102,
            message: `Impossible to write in file ${path}`,
            extra: message,
            permalink: `file-exception-write?path=${path}&message=${message}`
        });
    }
}
exports.FileException = FileException;
class EntityException {
    duplicateEntity(entity) {
        return materiaException({
            code: 201,
            message: `Duplicate entity ${entity}`,
            permalink: `file-exception-entity?name=${entity}`
        });
    }
}
exports.EntityException = EntityException;
let EntityFieldException = {};
exports.FileException = FileException;
//# sourceMappingURL=exception.js.map