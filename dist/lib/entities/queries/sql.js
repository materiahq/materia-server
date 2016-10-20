'use strict';
var Query = require('../query');
class SQLQuery extends Query {
    constructor(entity, id, params, opts) {
        super(entity, id, params);
        if (!opts || !opts.query)
            throw new Error('missing required parameter "query"');
        this.type = 'sql';
        this.params = params || {};
        this.values = opts.values || {};
        this.query = opts.query;
        this.refresh();
    }
    refresh() {
        this.valuesType = {};
        Object.keys(this.values).forEach((field) => {
            if (this.values[field].substr(0, 1) == '=') {
                this.valuesType[field] = 'param';
            }
            else {
                this.valuesType[field] = 'value';
            }
        });
    }
    run(params) {
        let resolvedParams = this.resolveParams(params);
        for (let param of this.params) {
            if (resolvedParams[param.name]) {
                if (typeof resolvedParams[param.name] == 'string') {
                    if (param.type == 'date')
                        resolvedParams[param.name] = new Date(resolvedParams[param.name]);
                }
            }
        }
        return this.entity.app.database.sequelize.query(this.query, {
            replacements: resolvedParams,
            type: this.entity.app.database.sequelize.QueryTypes.SELECT
        });
    }
    toJson() {
        let res = {
            id: this.id,
            type: 'sql',
            params: this.params,
            opts: {
                values: this.values,
                query: this.query
            }
        };
        return res;
    }
}
module.exports = SQLQuery;
//# sourceMappingURL=sql.js.map