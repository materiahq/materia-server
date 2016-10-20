'use strict';
let fs = require('fs');
let path = require('path');
/**
 * Default action types
 * @readonly
 * @enum {string}
 */
exports.MigrationType = {
    // entities
    CREATE_ENTITY: 'create_entity',
    RENAME_ENTITY: 'rename_entity',
    DELETE_ENTITY: 'delete_entity',
    ADD_FIELD: 'create_field',
    CHANGE_FIELD: 'change_field',
    DELETE_FIELD: 'delete_field',
    ADD_RELATION: 'add_relation',
    DELETE_RELATION: 'delete_relation',
    // queries
    ADD_QUERY: 'add_query',
    DELETE_QUERY: 'delete_query',
    //ADD_QUERY_PARAM: 'add_query_param',
    //DELETE_QUERY_PARAM: 'delete_query_param',
    //UPDATE_QUERY_VALUE: 'update_query_value',
    UPDATE_QUERY: 'update_query',
    // api
    ADD_ENDPOINT: 'add_endpoint',
    DELETE_ENDPOINT: 'delete_endpoint',
    UPDATE_ENDPOINT: 'update_endpoint'
};
/**
 * @class History
 * @classdesc
 * Used to store the last actions and undo / redo these actions.
 */
class History {
    constructor(app) {
        this.app = app;
        this.actions = {};
        this.diff = [];
        this.diffRedo = [];
    }
    cleanStacks() {
        let diff = [];
        for (let d of this.diff)
            diff.push({ undo: d.undo, redo: d.redo });
        let diff_redo = [];
        for (let d of this.diffRedo)
            diff_redo.push({ undo: d.undo, redo: d.redo });
        this.diff = diff;
        this.diffRedo = diff_redo;
    }
    load() {
        try {
            let changes = fs.readFileSync(path.join(this.app.path, 'changes.json'));
            this.diff = JSON.parse(changes.toString());
        }
        catch (e) {
            this.diff = [];
        }
    }
    save(opts) {
        if (opts && opts.beforeSave) {
            opts.beforeSave('changes.json');
        }
        this.cleanStacks();
        fs.writeFileSync(path.join(this.app.path, 'changes.json'), JSON.stringify(this.diff, null, '\t'));
        if (opts && opts.afterSave) {
            opts.afterSave();
        }
    }
    /**
    Push an action in the history
    @param {object} - Redo action object
    @param {object} - Undo action object
    */
    push(redo, undo) {
        this.diff.push({ undo: undo, redo: redo });
        this.diffRedo = [];
        this.save();
    }
    /**
    Register a type of action
    @param {string} - Type name
    @param {function} - Action's function
    */
    register(type, action) {
        this.actions[type] = action;
    }
    /**
    Is action(s) available in undo stack
    @returns {boolean}
    */
    undoable() {
        return this.diff.length > 0;
    }
    /**
    Is action(s) available in redo stack
    @returns {boolean}
    */
    redoable() {
        return this.diffRedo.length > 0;
    }
    /**
    Get the actions available in undo stack
    @returns {Array}
    */
    getUndoStack() {
        return this.diff;
    }
    /**
    Get the actions available in redo stack
    @returns {Array}
    */
    getRedoStack() {
        return this.diffRedo;
    }
    /**
    Undo the last action
    @param {object} - Action's options
    @returns {Promise<object>} the action applied
    */
    undo(opts) {
        opts = opts || { history: false };
        if (this.diff.length == 0)
            return Promise.resolve({});
        let actionobj = this.diff.pop();
        this.diffRedo.push(actionobj);
        let action = this.actions[actionobj.undo.type];
        let p;
        if (actionobj.undo.table
            && !this.app.entities.get(actionobj.undo.table)
            && actionobj.redo.type != exports.MigrationType.CREATE_ENTITY
            && actionobj.undo.type != exports.MigrationType.DELETE_ENTITY
            && actionobj.undo.type != exports.MigrationType.RENAME_ENTITY)
            p = Promise.resolve();
        else
            p = action(actionobj.undo, opts);
        return p.then(() => {
            if (opts.save)
                this.save(opts);
            return Promise.resolve(actionobj.undo);
        }).catch((err) => {
            if (opts.save)
                this.save(opts);
            throw err;
        });
    }
    /**
    Redo the last cancelled action
    @param {object} - Action's options
    @returns {Promise<object>} the action applied
    */
    redo(opts) {
        opts = opts || { history: false };
        if (this.diffRedo.length == 0)
            return Promise.resolve({});
        let actionobj = this.diffRedo.pop();
        this.diff.push(actionobj);
        let action = this.actions[actionobj.redo.type];
        let p;
        if (actionobj.redo.table
            && !this.app.entities.get(actionobj.redo.table)
            && actionobj.redo.type != exports.MigrationType.CREATE_ENTITY
            && actionobj.redo.type != exports.MigrationType.DELETE_ENTITY
            && actionobj.redo.type != exports.MigrationType.RENAME_ENTITY)
            p = Promise.resolve();
        else
            p = action(actionobj.redo, opts);
        return p.then(() => {
            if (opts.save)
                this.save(opts);
            return Promise.resolve(actionobj.redo);
        }).catch((err) => {
            if (opts.save)
                this.save(opts);
            throw err;
        });
    }
    /**
    Clear the history
    */
    clear() {
        this.diff = [];
        this.diffRedo = [];
    }
    /**
    Revert actions from a diff array
    @param {Array<object>} - The diffs list
    @param {object} - Action's options
    @returns {Promise<Array>} the applied actions
    */
    revert(diffs, opts) {
        let diff_redo = this.diffRedo;
        let diff_undo = this.diff;
        this.diffRedo = [];
        this.diff = [];
        if (diffs && diffs.length) {
            for (let diff of diffs) {
                this.diff.push(diff);
            }
        }
        let actions = [];
        let p = Promise.resolve({ type: null });
        for (let i in this.diff) {
            p = p.then((action) => {
                if (action.type)
                    actions.push(action);
                return this.undo(opts);
            });
        }
        p = p.then((action) => {
            if (action.type) {
                actions.push(action);
            }
            this.diffRedo = diff_redo;
            this.diff = diff_undo;
            return Promise.resolve(actions);
        }).catch((e) => {
            console.error('Could not revert', e.stack);
            this.diffRedo = diff_redo;
            this.diff = diff_undo;
            throw e;
        });
        return p;
    }
    /**
    Apply actions from a diff array
    @param {Array<object>} - The diffs list
    @param {object} - Action's options
    @returns {Promise<Array>} the applied actions
    */
    apply(diffs, opts) {
        let diff_redo = this.diffRedo;
        let diff_undo = this.diff;
        this.diffRedo = [];
        this.diff = [];
        if (diffs && diffs.length) {
            for (let diff of diffs) {
                this.diffRedo.unshift(diff);
            }
        }
        let actions = [];
        let p = Promise.resolve({ type: null, table: null });
        for (let i in this.diffRedo) {
            p = p.then((action) => {
                if (action.type) {
                    actions.push(action);
                }
                return this.redo(opts);
            });
        }
        p = p.then((action) => {
            if (action.type) {
                actions.push(action);
            }
            this.diffRedo = diff_redo;
            this.diff = diff_undo;
            return Promise.resolve(actions);
        }).catch((e) => {
            this.diffRedo = diff_redo;
            this.diff = diff_undo;
            console.log('Error while updating', e.stack);
            throw e;
        });
        return p;
    }
}
exports.History = History;
//# sourceMappingURL=history.js.map