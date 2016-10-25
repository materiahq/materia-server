"use strict";
const path = require('path');
const Sequelize = require('sequelize');
let domain = require('domain');
const server_1 = require('./server');
const interface_1 = require('./database/interface');
(function (Dialect) {
    Dialect[Dialect["POSTGRES"] = 0] = "POSTGRES";
    Dialect[Dialect["SQLITE"] = 1] = "SQLITE";
    Dialect[Dialect["MYSQL"] = 2] = "MYSQL";
})(exports.Dialect || (exports.Dialect = {}));
var Dialect = exports.Dialect;
/**
 * @class Database
 * @classdesc
 * Represent the connection to database
 */
class Database {
    constructor(app) {
        this.app = app;
        this.locked = false;
        this.interface = new interface_1.DatabaseInterface(this);
    }
    /**
    Get the database configuration
    @param {string} - *optional* The environment mode. `development` or `production`. Default to `development`
    @returns {object}
    */
    getConfig(mode, options) {
        return this.app.server.getConfig(mode, server_1.ConfigType.DATABASE, options);
    }
    /**
    Load the database configuration
    @param {object} - *optional* The settings of the database
    @returns {object}
    */
    load(settings) {
        this.disabled = false;
        if (!settings && this.app.path) {
            this.app.server.reloadConfig();
            if (this.app.live) {
                settings = this.getConfig(this.app.mode, { live: true });
            }
            settings = settings || this.getConfig(this.app.mode);
        }
        if (!settings) {
            this.disabled = true;
            return false;
        }
        this.host = this.app.options['database-host'] || settings.host || 'localhost';
        this.port = Number(this.app.options['database-port'] || settings.port);
        this.username = this.app.options['database-username'] || settings.username;
        this.password = this.app.options['database-password'] || settings.password;
        this.database = this.app.options['database-db'] || settings.database;
        this.storage = this.app.options['storage'] || settings.storage;
        this.type = settings.type;
        this.started = false;
        let logging;
        if (this.app.options.logSql == true)
            logging = (...args) => { this.app.logger.log.apply(this.app.logger, args); };
        else if (this.app.options.logSql !== undefined)
            logging = this.app.options.logSql;
        else
            logging = false;
        this.opts = {
            dialect: this.type,
            host: this.host,
            port: this.port,
            logging: logging
        };
        if (this.type == 'sqlite') {
            this.opts.storage = path.resolve(this.app.path, this.storage || 'database.sqlite');
        }
        return true;
    }
    _confToJson(conf) {
        if (!conf) {
            return null;
        }
        if (conf.type != 'sqlite') {
            return {
                type: conf.type,
                host: conf.host,
                port: conf.port,
                database: conf.database,
                username: conf.username,
                password: conf.password
            };
        }
        else {
            let res = {
                type: conf.type
            };
            if (conf.storage && conf.storage != "database.sqlite") {
                res.storage = conf.storage;
            }
            return res;
        }
    }
    /**
    Try to connect with a custom configuration
    @param {object} - The configuration object
    @returns {Promise}
    */
    static try(settings, app) {
        //TODO: check settings.storage to be a real path
        if (settings.type == 'sqlite' && settings.storage) {
            return Promise.resolve();
        }
        let opts = {
            dialect: settings.type,
            host: settings.host,
            port: settings.port,
            logging: false
        };
        if (settings.type == 'sqlite' && app) {
            opts.storage = path.resolve(app.path, settings.storage || 'database.sqlite');
        }
        let tmp;
        return new Promise((accept, reject) => {
            let d = domain.create();
            try {
                tmp = new Sequelize(settings.database, settings.username, settings.password, opts);
            }
            catch (e) {
                return reject(e);
            }
            d.add(tmp.query);
            d.on('error', (e) => {
                d.remove(tmp.query);
                return reject(e);
            });
            d.run(() => {
                return tmp.authenticate().then(() => {
                    tmp.close();
                    accept();
                }).catch((e) => { reject(e); });
            });
        });
    }
    try(settings) {
        return Database.try(settings, this.app);
    }
    /**
    Connect to the database
    @returns {Promise}
    */
    start() {
        if (this.sequelize) {
            this.stop();
        }
        if (this.disabled) {
            return Promise.resolve();
        }
        if (!this.interface.hasDialect(this.type)) {
            return Promise.reject(new Error('The database\'s dialect is not supported'));
        }
        this.app.emit('db:start');
        try {
            this.sequelize = new Sequelize(this.database, this.username, this.password, this.opts);
        }
        catch (e) {
            return Promise.reject(e);
        }
        this.interface.setDialect(this.type);
        let auth = this.sequelize.authenticate();
        return auth.then(() => {
            this.app.emit('db:authorized');
            this.started = true;
            this.app.emit('db:started');
        }).catch((e) => {
            this.app.logger.warn('Impossible to connect the database:', e && e.message);
            this.app.logger.warn('The database has been disabled');
            this.disabled = true;
            return Promise.resolve(e);
        });
    }
    /**
    Stop the database connection
    */
    stop() {
        this.started = false;
        if (this.sequelize) {
            this.sequelize.close();
            this.sequelize = null;
        }
    }
    /**
    Synchronize the database with the state of the application
    @returns {Promise}
    */
    sync() {
        return this.app.entities.sync().then(() => {
            return this.sequelize.sync();
        });
    }
    //Deprecated: use sync() instead as sequelize({force: true}) will remove all data
    forceSync() {
        return this.app.entities.sync().then(() => {
            return this.sequelize.sync({ force: true });
        });
    }
}
exports.Database = Database;
//# sourceMappingURL=database.js.map