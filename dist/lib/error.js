"use strict";
class MateriaError extends Error {
    constructor(message, options) {
        super(message);
        if (options) {
            this.slug = options.slug;
            this.issue = options.issue;
            this.debug = options.debug;
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MateriaError;
//# sourceMappingURL=error.js.map